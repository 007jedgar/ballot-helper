"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CandidateCard } from "@/components/candidate-card";
import { NoBallot } from "@/components/empty-state";
import { MeasurePanel } from "@/components/measure-panel";
import { Badge, Button, FlagIcon, Toggle, buttonClass, kindLabel } from "@/components/ui";
import { retryJob } from "@/lib/research";
import { candidateKey, useBallot, useHydrated, type Contest } from "@/lib/store";

export default function ComparePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const ballot = useBallot((s) => s.ballot);
  const rawStep = useBallot((s) => s.step);
  const setStep = useBallot((s) => s.setStep);
  const choices = useBallot((s) => s.choices);
  const showFlags = useBallot((s) => s.showFlags);
  const setShowFlags = useBallot((s) => s.setShowFlags);
  const candidates = useBallot((s) => s.candidates);

  const count = ballot?.contests.length ?? 0;
  const step = Math.min(Math.max(rawStep, 0), Math.max(count - 1, 0));
  const isLast = step === count - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "j") {
        if (isLast) router.push("/review");
        else setStep(step + 1);
      }
      if ((e.key === "ArrowLeft" || e.key === "k") && step > 0) setStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, isLast, setStep, router]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  if (!hydrated) return null;
  if (!ballot || !count) return <NoBallot />;
  const contest = ballot.contests[step];

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
      <aside className="sticky top-22 hidden h-[calc(100vh-7rem)] w-60 shrink-0 overflow-y-auto lg:block">
        <p className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">Ballot</p>
        <ol className="space-y-0.5">
          {ballot.contests.map((c, i) => {
            const picked = (choices[c.id] ?? []).length > 0;
            const flagged =
              showFlags && c.candidates.some((_, j) => (candidates[candidateKey(c.id, j)]?.data?.redFlags ?? []).length > 0);
            return (
              <li key={c.id}>
                <button
                  onClick={() => setStep(i)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                    i === step ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] ${
                      picked ? "border-accent bg-accent text-white" : "border-line-strong"
                    }`}
                  >
                    {picked && "✓"}
                  </span>
                  <span className="truncate">{c.title}</span>
                  {flagged && <FlagIcon className="ml-auto h-3 w-3 shrink-0 text-bad" />}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / count) * 100}%` }} />
          </div>
          <span className="font-mono text-[11px] text-faint">
            {step + 1}/{count}
          </span>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{kindLabel(contest.kind)}</Badge>
              {contest.isJudicial && <Badge tone="accent">Judicial</Badge>}
            </div>
            {contest.kind !== "measure" && (
              <Toggle
                checked={showFlags}
                onChange={setShowFlags}
                label={
                  <span className="inline-flex items-center gap-1">
                    <FlagIcon className={showFlags ? "text-bad" : ""} /> Red flags
                  </span>
                }
              />
            )}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{contest.title}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {[contest.district, instructions(contest)].filter(Boolean).join(" · ")}
          </p>
        </div>

        <ContestBody contest={contest} />

        <div className="sticky bottom-0 mt-10 flex items-center justify-between border-t border-line bg-bg/85 py-4 backdrop-blur-md">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ← Back
          </Button>
          <span className="hidden text-[12px] text-faint sm:inline">Use ← → to move between items</span>
          {isLast ? (
            <Link href="/review" className={buttonClass("primary")}>
              Review & export →
            </Link>
          ) : (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              {(choices[contest.id] ?? []).length ? "Next" : "Skip"} →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const NONE: string[] = [];

function instructions(c: Contest) {
  if (c.kind === "candidate") return c.voteFor > 1 ? `Vote for up to ${c.voteFor}` : "Vote for one";
  return "Vote yes or no";
}

function ContestBody({ contest }: { contest: Contest }) {
  const chosen = useBallot((s) => s.choices[contest.id]) ?? NONE;
  const toggle = useBallot((s) => s.toggleChoice);
  const candidates = useBallot((s) => s.candidates);
  const measures = useBallot((s) => s.measures);
  const showFlags = useBallot((s) => s.showFlags);
  const options = contest.options.length ? contest.options : ["Yes", "No"];

  if (contest.kind === "measure") {
    return (
      <>
        <MeasurePanel
          job={measures[contest.id] ?? { status: "idle" }}
          text={contest.measureText}
          onRetry={() => retryJob({ kind: "measure", key: contest.id, contest })}
        />
        <OptionPicker options={options} chosen={chosen} onPick={(o) => toggle(contest.id, o, 1)} />
      </>
    );
  }

  const cols = contest.candidates.length >= 3 ? "lg:grid-cols-3" : contest.candidates.length === 2 ? "md:grid-cols-2" : "";
  return (
    <>
      <div className={`grid items-start gap-4 ${cols} ${contest.kind === "retention" ? "max-w-xl" : ""}`}>
        {contest.candidates.map((c, i) => {
          const key = candidateKey(contest.id, i);
          return (
            <CandidateCard
              key={key}
              name={c.name}
              party={c.party}
              isJudicial={contest.isJudicial}
              job={candidates[key] ?? { status: "idle" }}
              selected={chosen.includes(c.name)}
              selectable={contest.kind === "candidate"}
              showFlags={showFlags}
              onSelect={() => toggle(contest.id, c.name, contest.voteFor)}
              onRetry={() => retryJob({ kind: "candidate", key, contest, index: i })}
            />
          );
        })}
      </div>
      {contest.kind === "retention" && (
        <OptionPicker options={options} chosen={chosen} onPick={(o) => toggle(contest.id, o, 1)} />
      )}
      {contest.kind === "candidate" && contest.voteFor > 1 && (
        <p className="mt-4 text-[13px] text-muted">
          {chosen.length}/{contest.voteFor} selected
        </p>
      )}
    </>
  );
}

function OptionPicker({ options, chosen, onPick }: { options: string[]; chosen: string[]; onPick: (o: string) => void }) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">Your vote</p>
      <div className="flex gap-3">
        {options.map((o) => (
          <Button key={o} variant={chosen.includes(o) ? "primary" : "secondary"} className="h-11 min-w-28 text-sm" onClick={() => onPick(o)}>
            {chosen.includes(o) && "✓ "}
            {o}
          </Button>
        ))}
      </div>
    </div>
  );
}
