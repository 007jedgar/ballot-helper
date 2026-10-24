"use client";

import Link from "next/link";
import { NoBallot } from "@/components/empty-state";
import { ShareButton } from "@/components/share-button";
import { Badge, Button, Spinner, buttonClass, kindLabel } from "@/components/ui";
import { PARTY_LABELS, planContest } from "@/lib/prefs";
import { formatEta, jobState, listJobs, retryJob, useEta, useProgress, type ResearchJob } from "@/lib/research";
import { useBallot, useHydrated } from "@/lib/store";

export default function ResearchPage() {
  const hydrated = useHydrated();
  const ballot = useBallot((s) => s.ballot);
  const removeContest = useBallot((s) => s.removeContest);
  const paused = useBallot((s) => s.paused);
  const setPaused = useBallot((s) => s.setPaused);
  const prefs = useBallot((s) => s.prefs);
  const prefsConfirmed = useBallot((s) => s.prefsConfirmed);
  const forced = useBallot((s) => s.forced);
  const forceContest = useBallot((s) => s.forceContest);
  const { done, total, errors } = useProgress();
  // `remaining` excludes failed items, so the estimate and Pause go away once nothing is left to run.
  const { pct, etaMs, remaining } = useEta();
  if (!hydrated) return null;
  if (!ballot) return <NoBallot />;
  if (!prefsConfirmed) {
    return (
      <div className="mx-auto max-w-md px-4 py-32 text-center">
        <p className="text-sm font-medium">Choose what to research first</p>
        <p className="mt-1 text-[13px] text-muted">Tell us what you care about so research only covers what you need.</p>
        <Link href="/setup" className={buttonClass("primary", "mt-6")}>
          Set up research
        </Link>
      </div>
    );
  }

  const jobs = listJobs(ballot, prefs, forced);
  const header = [ballot.electionName, ballot.electionDate, ballot.jurisdiction ?? ballot.county, ballot.state]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted">{header || "Your ballot"}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Researching your ballot</h1>
          <p className="mt-2 text-[13px] text-muted">
            {paused && remaining > 0
              ? "Research paused."
              : remaining > 0
              ? "You can start comparing now. Research keeps running in the background, starting with whatever race you're viewing."
              : errors
                ? `${errors} item${errors > 1 ? "s" : ""} failed. Retry below.`
                : "All research complete."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/setup" className={buttonClass("ghost")}>
            Preferences
          </Link>
          {done > 0 && <ShareButton />}
          {remaining > 0 && <Button onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</Button>}
          <Link href="/compare" className={buttonClass("primary")}>
            Start comparing →
          </Link>
        </div>
      </div>

      <div className="mt-8 flex items-baseline justify-between gap-4">
        <p className="font-mono text-[11px] text-faint">
          {done}/{total} researched
        </p>
        {remaining > 0 && (
          <p className="text-[13px] tabular-nums">
            <span className="font-medium text-fg">{pct}%</span>
            <span className="text-muted">
              {" · "}
              {paused ? "paused" : etaMs != null ? formatEta(etaMs) : "estimating time…"}
            </span>
          </p>
        )}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-8 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {ballot.contests.map((contest) => {
          const contestJobs = jobs.filter((j) => j.contest.id === contest.id);
          const plan = planContest(contest, prefs, Boolean(forced[contest.id]));
          const skippedNote = !plan.research
            ? plan.reason === "uncontested"
              ? "Uncontested, skipped"
              : "Skipped by your settings"
            : plan.partyFiltered && prefs.party && plan.candidates.length < contest.candidates.length
              ? `Only ${PARTY_LABELS[prefs.party]} candidates checked`
              : null;
          return (
            <li key={contest.id} className="group p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge>{kindLabel(contest.kind)}</Badge>
                    {contest.isJudicial && <Badge tone="accent">Judicial</Badge>}
                    {contest.voteFor > 1 && <Badge>Vote for {contest.voteFor}</Badge>}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium">{contest.title}</p>
                  {contest.district && <p className="text-[13px] text-muted">{contest.district}</p>}
                </div>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-[12px] opacity-0 group-hover:opacity-100"
                  onClick={() => removeContest(contest.id)}
                  title="Remove if this was misread"
                >
                  Remove
                </Button>
              </div>
              <ul className="mt-3 space-y-1.5">
                {contestJobs.map((job) => (
                  <JobRow key={job.key} job={job} />
                ))}
              </ul>
              {skippedNote && (
                <p className="mt-2 flex items-center gap-2 text-[13px] text-faint">
                  {skippedNote}
                  <button className="text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => forceContest(contest.id)}>
                    Research {contest.kind === "measure" ? "this measure" : "everyone"}
                  </button>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function JobRow({ job }: { job: ResearchJob }) {
  // Subscribe so the row re-renders when its job changes.
  useBallot((s) => (job.kind === "measure" ? s.measures[job.key] : s.candidates[job.key]));
  const state = jobState(job);
  const label =
    job.kind === "measure"
      ? "Analysis"
      : `${job.contest.candidates[job.index].name}${job.contest.candidates[job.index].party ? ` · ${job.contest.candidates[job.index].party}` : ""}`;

  return (
    <li className="flex items-center justify-between gap-3 text-[13px]">
      <span className="flex min-w-0 items-center gap-2.5">
        {state.status === "done" ? (
          <span className="text-good">●</span>
        ) : state.status === "error" ? (
          <span className="text-bad">●</span>
        ) : state.status === "loading" ? (
          <Spinner />
        ) : (
          <span className="text-faint">○</span>
        )}
        <span className={`truncate ${state.status === "done" ? "text-fg" : "text-muted"}`}>{label}</span>
      </span>
      {state.status === "error" && (
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden max-w-56 truncate text-bad/80 sm:inline" title={state.error}>
            {state.error}
          </span>
          <Button variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => retryJob(job)}>
            Retry
          </Button>
        </span>
      )}
      {state.status === "idle" && <span className="text-faint">Queued</span>}
    </li>
  );
}
