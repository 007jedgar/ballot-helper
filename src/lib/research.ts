"use client";

import { useEffect, useState } from "react";
import type { CandidateResearch, MeasureResearch } from "./schema";
import { candidateKey, useBallot, type Ballot, type Contest, type Job } from "./store";

const CONCURRENCY = 4;
const inflight = new Set<string>();

// Throughput for this tab's session, used for the time estimate. Resets when
// research is paused so idle time doesn't drag the rate down.
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
  | { kind: "candidate"; key: string; contest: Contest; index: number }
  | { kind: "measure"; key: string; contest: Contest };

export function listJobs(ballot: Ballot): ResearchJob[] {
  return ballot.contests.flatMap<ResearchJob>((contest) =>
    contest.kind === "measure"
      ? [{ kind: "measure", key: contest.id, contest }]
      : contest.candidates.map((_, index) => ({ kind: "candidate", key: candidateKey(contest.id, index), contest, index })),
  );
}

export function jobState(job: ResearchJob): Job<unknown> {
  const s = useBallot.getState();
  return (job.kind === "measure" ? s.measures[job.key] : s.candidates[job.key]) ?? { status: "idle" };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.research as T;
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
      const data = await post<MeasureResearch>("/api/research/measure", {
        title: job.contest.title,
        district: job.contest.district,
        text: job.contest.measureText,
        election,
      });
      sessionDone++;
      useBallot.getState().setMeasureJob(job.key, { status: "done", data });
    } else {
      store.setCandidateJob(job.key, { status: "loading" });
      const c = job.contest.candidates[job.index];
      const data = await post<CandidateResearch>("/api/research/candidate", {
        name: c.name,
        party: c.party,
        office: job.contest.title,
        district: job.contest.district,
        isJudicial: job.contest.isJudicial,
        otherCandidates: job.contest.candidates.filter((_, i) => i !== job.index).map((o) => o.name),
        election,
      });
      sessionDone++;
      useBallot.getState().setCandidateJob(job.key, { status: "done", data });
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

  useEffect(() => {
    if (!ballot || paused) return;
    const order = new Map(ballot.contests.map((c, i) => [c.id, i < step ? i + ballot.contests.length : i]));
    const pending = listJobs(ballot)
      .filter((j) => !inflight.has(j.key) && jobState(j).status === "idle")
      .sort((a, b) => order.get(a.contest.id)! - order.get(b.contest.id)!);
    pending.slice(0, Math.max(0, CONCURRENCY - inflight.size)).forEach((j) => void run(j, ballot));
  }, [ballot, candidates, measures, step, paused]);
}

export function retryJob(job: ResearchJob) {
  const s = useBallot.getState();
  if (job.kind === "measure") s.setMeasureJob(job.key, { status: "idle" });
  else s.setCandidateJob(job.key, { status: "idle" });
}

export function useProgress() {
  const ballot = useBallot((s) => s.ballot);
  useBallot((s) => s.candidates);
  useBallot((s) => s.measures);
  if (!ballot) return { done: 0, total: 0, errors: 0 };
  const jobs = listJobs(ballot).map(jobState);
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

  const pct = total ? Math.round((done / total) * 100) : 0;
  const remaining = total - done - errors;
  const elapsed = sessionStart ? Math.max(now - sessionStart, 1) : 0;
  const etaMs =
    !paused && remaining > 0 && sessionDone >= MIN_SAMPLES && elapsed ? (remaining * elapsed) / sessionDone : null;
  return { pct, etaMs, ready: done >= MIN_SAMPLES };
}

export function formatEta(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 1) return "less than a minute left";
  if (min < 60) return `about ${min} min left`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `about ${h} hr${m ? ` ${m} min` : ""} left`;
}
