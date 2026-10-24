"use client";

import { useEffect, useState } from "react";
import { isFullTopics, planContest, type Prefs, type Topic } from "./prefs";
import type { CandidateResearch, MeasureResearch } from "./schema";
import { candidateKey, useBallot, type Ballot, type Contest, type Job } from "./store";

const CONCURRENCY = 4;
const inflight = new Set<string>();

// Throughput for this tab's session, used for the time estimate: only items
// actually researched count (not cache hits). Resets when research is paused
// so idle time doesn't drag the rate down.
let sessionStart: number | null = null;
let sessionDone = 0;
export function resetThroughput() {
  sessionStart = null;
  sessionDone = 0;
}

// Requests aborted by a reload/close aren't real failures; leave them "loading"
// so the store's rehydrate step requeues them.
let unloading = false;
if (typeof window !== "undefined") window.addEventListener("pagehide", () => (unloading = true));

export type ResearchJob =
  | { kind: "candidate"; key: string; contest: Contest; index: number; topics: Topic[] }
  | { kind: "measure"; key: string; contest: Contest };

/** The research the voter's preferences call for (plus any races they asked for explicitly). */
export function listJobs(ballot: Ballot, prefs: Prefs, forced: Record<string, true>): ResearchJob[] {
  return ballot.contests.flatMap<ResearchJob>((contest) => {
    const plan = planContest(contest, prefs, Boolean(forced[contest.id]));
    if (!plan.research) return [];
    if (contest.kind === "measure") return [{ kind: "measure", key: contest.id, contest }];
    return plan.candidates.map((index) => ({
      kind: "candidate",
      key: candidateKey(contest.id, index),
      contest,
      index,
      topics: plan.topics,
    }));
  });
}

/** Jobs for the current store state. */
export function currentJobs(): ResearchJob[] {
  const { ballot, prefs, forced } = useBallot.getState();
  return ballot ? listJobs(ballot, prefs, forced) : [];
}

export function jobState(job: ResearchJob): Job<unknown> {
  const s = useBallot.getState();
  return (job.kind === "measure" ? s.measures[job.key] : s.candidates[job.key]) ?? { status: "idle" };
}

async function postOnce(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  if (!res.ok) throw Object.assign(new Error(json.error ?? `Request failed (${res.status})`), { status: res.status });
  return json;
}

/** Retries once on server errors and timeouts (not on bad requests). */
async function post(url: string, body: unknown) {
  try {
    return await postOnce(url, body);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (unloading || (status && status < 500)) throw err;
    return postOnce(url, body);
  }
}

/**
 * Gather notes, then analyze them: two requests so each gets the full
 * function time limit. The first request returns cached research when the
 * server already has it.
 */
type Researched<T> = { data: T; cached: boolean; cost: number | null };

async function research<T>(url: string, input: Record<string, unknown>): Promise<Researched<T>> {
  const first = await post(url, input);
  const costOf = (v: unknown) => (typeof v === "number" ? v : null);
  // Served from the shared cache; `cost` is what it originally cost to research.
  if (first.research) return { data: first.research as T, cached: true, cost: costOf(first.cost) };
  const second = await post(url, { ...input, notes: first.notes, gatherCost: costOf(first.cost) });
  return { data: second.research as T, cached: false, cost: costOf(second.cost) };
}

/** Approximate USD of AI work behind the current ballot (reading it plus research). */
export function useBallotCost() {
  const parseCost = useBallot((s) => s.parseCost);
  const candidates = useBallot((s) => s.candidates);
  const measures = useBallot((s) => s.measures);
  let total = parseCost;
  for (const j of [...Object.values(candidates), ...Object.values(measures)]) total += j.cost ?? 0;
  return total;
}

async function run(job: ResearchJob, ballot: Ballot) {
  const store = useBallot.getState();
  const election = {
    electionName: ballot.electionName,
    electionDate: ballot.electionDate,
    state: ballot.state,
    county: ballot.county,
    jurisdiction: ballot.jurisdiction,
  };
  inflight.add(job.key);
  sessionStart ??= Date.now();
  try {
    if (job.kind === "measure") {
      store.setMeasureJob(job.key, { status: "loading" });
      const { data, cached, cost } = await research<MeasureResearch>("/api/research/measure", {
        title: job.contest.title,
        district: job.contest.district,
        text: job.contest.measureText,
        election,
      });
      // Instant cache hits would make the time estimate wildly optimistic.
      if (!cached) sessionDone++;
      useBallot.getState().setMeasureJob(job.key, { status: "done", data, cost });
    } else {
      store.setCandidateJob(job.key, { status: "loading" });
      const c = job.contest.candidates[job.index];
      const { data, cached, cost } = await research<CandidateResearch>("/api/research/candidate", {
        name: c.name,
        party: c.party,
        office: job.contest.title,
        district: job.contest.district,
        isJudicial: job.contest.isJudicial,
        otherCandidates: job.contest.candidates.filter((_, i) => i !== job.index).map((o) => o.name),
        election,
        // Omitted means a full profile (and shares the full-profile cache entry).
        ...(isFullTopics(job.topics) ? {} : { topics: job.topics }),
      });
      // Instant cache hits would make the time estimate wildly optimistic.
      if (!cached) sessionDone++;
      useBallot.getState().setCandidateJob(job.key, { status: "done", data, cost });
    }
  } catch (err) {
    if (unloading) return;
    const error = err instanceof Error ? err.message : "Research failed";
    const s = useBallot.getState();
    if (job.kind === "measure") s.setMeasureJob(job.key, { status: "error", error });
    else s.setCandidateJob(job.key, { status: "error", error });
  } finally {
    inflight.delete(job.key);
  }
}

/**
 * Keeps up to CONCURRENCY research requests running until every job has finished.
 * Jobs for the contest being viewed in the wizard (and the ones after it) go first.
 */
export function useResearchRunner() {
  const ballot = useBallot((s) => s.ballot);
  const candidates = useBallot((s) => s.candidates);
  const measures = useBallot((s) => s.measures);
  const step = useBallot((s) => s.step);
  const paused = useBallot((s) => s.paused);
  const prefs = useBallot((s) => s.prefs);
  const prefsConfirmed = useBallot((s) => s.prefsConfirmed);
  const forced = useBallot((s) => s.forced);

  useEffect(() => {
    if (!ballot || paused || !prefsConfirmed) return;
    const order = new Map(ballot.contests.map((c, i) => [c.id, i < step ? i + ballot.contests.length : i]));
    const pending = listJobs(ballot, prefs, forced)
      .filter((j) => !inflight.has(j.key) && jobState(j).status === "idle")
      .sort((a, b) => order.get(a.contest.id)! - order.get(b.contest.id)!);
    pending.slice(0, Math.max(0, CONCURRENCY - inflight.size)).forEach((j) => void run(j, ballot));
  }, [ballot, candidates, measures, step, paused, prefs, prefsConfirmed, forced]);
}

export function retryJob(job: Pick<ResearchJob, "kind" | "key">) {
  const s = useBallot.getState();
  if (job.kind === "measure") s.setMeasureJob(job.key, { status: "idle" });
  else s.setCandidateJob(job.key, { status: "idle" });
}

export function useProgress() {
  const ballot = useBallot((s) => s.ballot);
  const prefs = useBallot((s) => s.prefs);
  const forced = useBallot((s) => s.forced);
  useBallot((s) => s.candidates);
  useBallot((s) => s.measures);
  if (!ballot) return { done: 0, total: 0, errors: 0 };
  const jobs = listJobs(ballot, prefs, forced).map(jobState);
  return {
    total: jobs.length,
    done: jobs.filter((j) => j.status === "done").length,
    errors: jobs.filter((j) => j.status === "error").length,
  };
}

const MIN_SAMPLES = 3;

/**
 * Percent complete and estimated time left, once a few items have finished
 * this session. `etaMs` is null until there is enough data (or while paused).
 */
export function useEta() {
  const { done, total, errors } = useProgress();
  const paused = useBallot((s) => s.paused);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (paused) resetThroughput();
  }, [paused]);

  // Round down so "100%" only appears when everything is actually done.
  const pct = total ? Math.floor((done / total) * 100) : 0;
  const remaining = total - done - errors;
  const elapsed = sessionStart ? Math.max(now - sessionStart, 1) : 0;
  const etaMs =
    !paused && remaining > 0 && sessionDone >= MIN_SAMPLES && elapsed ? (remaining * elapsed) / sessionDone : null;
  return { pct, etaMs, remaining };
}

export function formatEta(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 1) return "less than a minute left";
  if (min < 60) return `about ${min} min left`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `about ${h} hr${m ? ` ${m} min` : ""} left`;
}
