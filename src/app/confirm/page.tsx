"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NoBallot } from "@/components/empty-state";
import { Badge, Button, kindLabel } from "@/components/ui";
import { CATEGORIES, CATEGORY_LABELS, PARTIES, PARTY_LABELS, categoryOf, partyOf } from "@/lib/prefs";
import { httpUrl } from "@/lib/schema";
import { useBallot, useHydrated, type Contest } from "@/lib/store";

/**
 * Shown after an address/ZIP lookup: the voter checks the races we found
 * against what they expect, fixes parties, drops what isn't theirs, and
 * confirms before any research runs.
 */
export default function ConfirmPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const ballot = useBallot((s) => s.ballot);
  const foundBy = useBallot((s) => s.foundBy);
  const reset = useBallot((s) => s.reset);

  if (!hydrated) return null;
  if (!ballot) return <NoBallot />;

  const groups = CATEGORIES.map((cat) => ({ cat, contests: ballot.contests.filter((c) => categoryOf(c) === cat) })).filter(
    (g) => g.contests.length,
  );
  const place = [ballot.jurisdiction ?? ballot.county, ballot.state].filter(Boolean).join(", ");
  const sources = (ballot.sources ?? []).filter((s) => httpUrl(s.url));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-40 pt-12 sm:px-6">
      <p className="text-[13px] text-muted">
        {[ballot.electionName, ballot.electionDate, place].filter(Boolean).join(" · ") || "Your ballot"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Is this your ballot?</h1>
      <p className="mt-2 text-[13px] text-muted">
        Check these {ballot.contests.length} items against what you expect to see. Remove races or candidates that
        aren&apos;t on your ballot and fix any missing parties before we start researching.
      </p>

      {foundBy && (
        <p className="mt-5 rounded-xl border border-warn/30 bg-warn/10 p-4 text-[13px] leading-relaxed text-fg/90">
          We built this ballot by searching the web for races in {foundBy}, not from an official sample ballot. An area
          can include several districts, so some of these races may not be on your ballot, and a few could be missing.
          Your county elections office&apos;s sample ballot is the final word.
        </p>
      )}

      {sources.length > 0 && (
        <section className="mt-5 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-[13px] font-medium">Where this came from</h2>
          <p className="mt-1 text-[13px] text-muted">Open these to compare against the original.</p>
          <ul className="mt-3 space-y-2">
            {sources.map((s) => (
              <li key={s.url} className="flex items-start gap-2 text-[13px]">
                {s.official ? <Badge tone="good">Official</Badge> : <Badge>Unofficial</Badge>}
                <a href={httpUrl(s.url)!} target="_blank" rel="noreferrer" className="min-w-0 break-words leading-5 underline-offset-2 hover:underline">
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.map(({ cat, contests }) => (
        <section key={cat} className="mt-8">
          <h2 className="mb-2 text-[13px] font-medium text-muted">{CATEGORY_LABELS[cat]}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {contests.map((c) => (
              <ContestRow key={c.id} contest={c} />
            ))}
          </ul>
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[13px] text-muted">
            Wrong ballot?{" "}
            <Link href="/" onClick={reset} className="text-fg underline underline-offset-2">
              Start over
            </Link>{" "}
            and upload your official sample ballot instead.
          </p>
          <Button
            variant="primary"
            className="h-10 px-5 text-sm"
            disabled={!ballot.contests.length}
            onClick={() => router.push("/setup")}
          >
            Looks right, continue →
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContestRow({ contest: c }: { contest: Contest }) {
  const removeContest = useBallot((s) => s.removeContest);
  const removeCandidate = useBallot((s) => s.removeCandidate);
  const setParty = useBallot((s) => s.setCandidateParty);
  const source = httpUrl(c.sourceUrl);

  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{kindLabel(c.kind)}</Badge>
            {c.isJudicial && <Badge tone="accent">Judicial</Badge>}
            {c.voteFor > 1 && <Badge>Vote for {c.voteFor}</Badge>}
          </div>
          <p className="mt-2 text-sm font-medium">{c.title}</p>
          {c.district && <p className="text-[13px] text-muted">{c.district}</p>}
          {source && (
            <a href={source} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12px] text-faint underline-offset-2 hover:text-muted hover:underline">
              Source: {new URL(source).hostname.replace(/^www\./, "")} ↗
            </a>
          )}
        </div>
        <Button variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => removeContest(c.id)}>
          Not on my ballot
        </Button>
      </div>

      {c.kind === "measure" ? (
        c.measureText && <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted">{c.measureText}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {c.candidates.map((x, i) => (
            <li key={`${x.name}-${i}`} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate">{x.name}</span>
              <span className="flex shrink-0 items-center gap-1">
                {c.kind === "candidate" && (
                  <PartySelect value={x.party} onChange={(p) => setParty(c.id, i, p)} label={`Party for ${x.name}`} />
                )}
                {c.kind === "candidate" && (
                  <button
                    onClick={() => removeCandidate(c.id, i)}
                    className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-fg"
                    aria-label={`Remove ${x.name}`}
                    title="Not running / not on my ballot"
                  >
                    ×
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const NO_PARTY = "";

function PartySelect({ value, onChange, label }: { value: string | null; onChange: (p: string | null) => void; label: string }) {
  // Keep an unusual label as printed ("Working Families") unless it's one of the known parties.
  const custom = value && !partyOf(value) ? value : null;
  const current = value ? (custom ?? PARTY_LABELS[partyOf(value)!]) : NO_PARTY;
  return (
    <select
      aria-label={label}
      value={current}
      onChange={(e) => onChange(e.target.value || null)}
      className={`h-7 rounded-md border bg-surface-2 px-1.5 text-[12px] focus:border-line-strong focus:outline-none ${
        value ? "border-line text-muted" : "border-warn/40 text-warn"
      }`}
    >
      <option value={NO_PARTY}>{value ? "No party" : "Party?"}</option>
      {custom && <option value={custom}>{custom}</option>}
      {PARTIES.map((p) => (
        <option key={p} value={PARTY_LABELS[p]}>
          {PARTY_LABELS[p]}
        </option>
      ))}
    </select>
  );
}
