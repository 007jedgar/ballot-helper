"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NoBallot } from "@/components/empty-state";
import { Button } from "@/components/ui";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PARTIES,
  PARTY_LABELS,
  PRESETS,
  TOPICS,
  TOPIC_LABELS,
  categoryOf,
  partyOf,
  planContest,
  straightTicketPicks,
  type Category,
  type Prefs,
  type Topic,
} from "@/lib/prefs";
import { useBallot, useHydrated, type Ballot } from "@/lib/store";

// Rough per-item times (gather + analyze) used for the estimate; 4 run at once.
const SECONDS = { full: 95, narrow: 60, measure: 110 };
const CONCURRENCY = 4;

function summarize(ballot: Ballot, prefs: Prefs) {
  let candidates = 0;
  let measures = 0;
  let seconds = 0;
  for (const c of ballot.contests) {
    const plan = planContest(c, prefs);
    if (!plan.research) continue;
    if (c.kind === "measure") {
      measures++;
      seconds += SECONDS.measure;
    } else {
      candidates += plan.candidates.length;
      seconds += plan.candidates.length * (plan.topics.length <= 2 ? SECONDS.narrow : SECONDS.full);
    }
  }
  return { candidates, measures, minutes: Math.max(1, Math.round(seconds / CONCURRENCY / 60)) };
}

export default function SetupPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const ballot = useBallot((s) => s.ballot);
  const saved = useBallot((s) => s.prefs);
  const confirmPrefs = useBallot((s) => s.confirmPrefs);
  const [draft, setDraft] = useState<Prefs | null>(null);
  const [preselect, setPreselect] = useState(true);

  if (!hydrated) return null;
  if (!ballot) return <NoBallot />;
  const prefs = draft ?? saved;
  const update = (patch: Partial<Prefs>) => setDraft({ ...prefs, ...patch });
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const counts = Object.fromEntries(CATEGORIES.map((k) => [k, 0])) as Record<Category, number>;
  for (const c of ballot.contests) counts[categoryOf(c)]++;
  const partisan = ballot.contests.some((c) => c.candidates.some((x) => partyOf(x.party)));
  const totalPeople = ballot.contests.reduce((n, c) => n + (c.kind === "measure" ? 0 : c.candidates.length), 0);

  const plan = summarize(ballot, prefs);
  const everything = summarize(ballot, { party: null, topics: [...TOPICS], categories: [...CATEGORIES], skipUncontested: false });
  const nothing = plan.candidates + plan.measures === 0;

  const start = () => {
    confirmPrefs(prefs, preselect && prefs.party ? straightTicketPicks(ballot.contests, prefs.party) : {});
    router.push("/research");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-40 pt-12 sm:px-6">
      <p className="text-[13px] text-muted">
        {ballot.contests.length} items · {totalPeople} candidates found on your ballot
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">What do you want to know?</h1>
      <p className="mt-2 text-[13px] text-muted">
        Narrowing this down makes research faster and cheaper. Anything you skip can still be researched later from the comparison screen.
      </p>

      {partisan && (
        <Section title="Do you usually vote a straight ticket?" hint="In partisan races we'll only check your party's candidates, for qualifications and red flags.">
          <div className="flex flex-wrap gap-2">
            <Chip on={prefs.party === null} onClick={() => update({ party: null })}>
              No, research everyone
            </Chip>
            {PARTIES.map((p) => (
              <Chip key={p} on={prefs.party === p} onClick={() => update({ party: p })}>
                {PARTY_LABELS[p]}
              </Chip>
            ))}
          </div>
          {prefs.party && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-fg/90">
              <input type="checkbox" checked={preselect} onChange={(e) => setPreselect(e.target.checked)} className="h-4 w-4 accent-[#5e6ad2]" />
              Pre-select {PARTY_LABELS[prefs.party]} candidates on my ballot
            </label>
          )}
        </Section>
      )}

      <Section title="What do you want to know about candidates?">
        <div className="mb-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Chip
              key={p.id}
              on={p.topics.length === prefs.topics.length && p.topics.every((t) => prefs.topics.includes(t))}
              onClick={() => update({ topics: [...p.topics] })}
            >
              {p.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t: Topic) => (
            <Toggle key={t} on={prefs.topics.includes(t)} onClick={() => update({ topics: toggle(prefs.topics, t) })}>
              {TOPIC_LABELS[t]}
            </Toggle>
          ))}
        </div>
        {prefs.topics.length === 0 && <p className="mt-2 text-[12px] text-warn">Pick at least one. With none selected, we&apos;ll check red flags only.</p>}
      </Section>

      <Section title="Which parts of the ballot?">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((k) => counts[k] > 0).map((k) => (
            <Toggle key={k} on={prefs.categories.includes(k)} onClick={() => update({ categories: toggle(prefs.categories, k) })}>
              {CATEGORY_LABELS[k]} <span className="font-mono text-[11px] opacity-60">{counts[k]}</span>
            </Toggle>
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-fg/90">
          <input
            type="checkbox"
            checked={prefs.skipUncontested}
            onChange={(e) => update({ skipUncontested: e.target.checked })}
            className="h-4 w-4 accent-[#5e6ad2]"
          />
          Skip uncontested races (only one candidate)
        </label>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-[13px]">
            <p>
              <span className="font-medium">
                {plan.candidates} candidate{plan.candidates === 1 ? "" : "s"}
                {plan.measures ? ` and ${plan.measures} measure${plan.measures === 1 ? "" : "s"}` : ""}
              </span>
              <span className="text-muted"> · about {plan.minutes} min</span>
            </p>
            <p className="text-muted">
              Everything would be {everything.candidates} candidates
              {everything.measures ? ` and ${everything.measures} measure${everything.measures === 1 ? "" : "s"}` : ""}, about{" "}
              {everything.minutes} min.
            </p>
          </div>
          <Button variant="primary" className="h-10 px-5 text-sm" onClick={start} disabled={nothing}>
            Start research →
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-8 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const chipBase = "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`${chipBase} ${on ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`${chipBase} ${on ? "border-line-strong bg-surface-2 text-fg" : "border-line text-faint line-through decoration-faint/60 hover:text-muted"}`}
    >
      <span className={`grid h-3.5 w-3.5 place-items-center rounded-[4px] border text-[9px] ${on ? "border-accent bg-accent text-white" : "border-line-strong"}`}>
        {on && "✓"}
      </span>
      {children}
    </button>
  );
}
