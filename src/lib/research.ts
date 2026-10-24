"use client";

import { useEffect } from "react";
import type { CandidateResearch, MeasureResearch } from "./schema";
import { candidateKey, useBallot, type Ballot, type Contest, type Job } from "./store";

const CONCURRENCY = 4;
const inflight = new Set<string>();

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
  try {
    if (job.kind === "measure") {
      store.setMeasureJob(job.key, { status: "loading" });
      const data = await post<MeasureResearch>("/api/research/measure", {
        title: job.contest.title,
        district: job.contest.district,
        text: job.contest.measureText,
        election,
      });
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
