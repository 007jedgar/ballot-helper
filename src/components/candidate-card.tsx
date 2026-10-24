"use client";

import type { CandidateResearch } from "@/lib/schema";
import type { Job } from "@/lib/store";
import { Bullets } from "./bullets";
import { Badge, Button, FlagIcon } from "./ui";

export function CandidateCard({
  name,
  party,
  isJudicial,
  job,
  selected,
  onSelect,
  onRetry,
  selectable = true,
  showFlags,
}: {
  name: string;
  party: string | null;
  isJudicial: boolean;
  job: Job<CandidateResearch>;
  selected: boolean;
  onSelect: () => void;
  onRetry: () => void;
  selectable?: boolean;
  showFlags: boolean;
}) {
  const r = job.data;
  // Research cached before red flags existed has no field.
  const flags = showFlags ? (r?.redFlags ?? []) : [];
  return (
    <article
      className={`flex flex-col rounded-xl border bg-surface transition-colors ${
        selected ? "border-accent shadow-[0_0_0_1px_var(--color-accent),0_8px_40px_-12px_rgb(94_106_210/0.5)]" : "border-line"
      }`}
    >
      <header className="border-b border-line p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
              {name}
              {flags.length > 0 && (
                <a
                  href={`#flags-${slug(name)}`}
                  title={flags.map((f) => f.title).join("\n")}
                  className="inline-flex items-center gap-0.5 text-bad"
                >
                  <FlagIcon />
                  {flags.length > 1 && <span className="font-mono text-[11px]">{flags.length}</span>}
                  <span className="sr-only">{flags.length} red flag{flags.length > 1 ? "s" : ""}</span>
                </a>
              )}
            </h3>
            <p className="text-[13px] text-muted">{r?.party ?? party ?? "Nonpartisan"}</p>
          </div>
          {selected && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px]">✓</span>}
        </div>
        {r && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.isIncumbent && <Badge tone="accent">Incumbent</Badge>}
            {r.age != null && r.age > 60 && <Badge>Age {r.age}</Badge>}
            {isJudicial && r.hasJD === true && <Badge tone="good">JD ✓</Badge>}
            {isJudicial && r.hasJD === false && <Badge tone="bad">No law degree found</Badge>}
            {isJudicial && r.hasJD == null && <Badge tone="warn">JD unverified</Badge>}
            {r.confidence === "low" && <Badge tone="warn">Limited info</Badge>}
          </div>
        )}
      </header>

      <div className="flex-1 space-y-5 p-4">
        {job.status === "done" && r ? (
          <>
            <p className="text-[13px] leading-relaxed text-muted">{r.oneLiner}</p>
            {flags.length > 0 && <RedFlags id={`flags-${slug(name)}`} flags={flags} />}
            <Bullets title="Qualifications" items={r.qualifications} />
            <Bullets title="Positions" items={r.keyPositions} />
            {r.isIncumbent && <Bullets title="Record in office" items={r.accomplishments} tone="good" />}
            <Bullets title="Criticisms" items={r.criticisms} tone="bad" limit={3} />
            <Bullets title="Endorsements" items={r.endorsements} limit={3} />
            <Links r={r} />
          </>
        ) : job.status === "error" ? (
          <div className="text-[13px]">
            <p className="text-bad">{job.error}</p>
            <Button variant="ghost" className="mt-2 h-7 px-2 text-[12px]" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-faint">Researching…</p>
            {[80, 95, 60, 85, 70].map((w, i) => (
              <div key={i} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
      </div>

      {selectable && (
        <footer className="p-4 pt-0">
          <Button variant={selected ? "primary" : "secondary"} className="w-full" onClick={onSelect}>
            {selected ? "Selected" : `Choose ${name.split(" ").at(-1)}`}
          </Button>
        </footer>
      )}
    </article>
  );
}

const FLAG_LABEL: Record<CandidateResearch["redFlags"][number]["kind"], string> = {
  conflict_of_interest: "Conflict of interest",
  conviction: "Criminal conviction",
  impeachment: "Impeachment",
  ethics_violation: "Ethics violation",
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function RedFlags({ id, flags }: { id: string; flags: CandidateResearch["redFlags"] }) {
  return (
    <div id={id} className="scroll-mt-24 space-y-3 rounded-lg border border-bad/30 bg-bad/[0.06] p-3">
      {flags.map((f, i) => (
        <div key={i} className="flex gap-2.5">
          <FlagIcon className="mt-0.5 shrink-0 text-bad" />
          <div className="min-w-0 text-[13px] leading-snug">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-bad/90">{FLAG_LABEL[f.kind]}</p>
            <p className="mt-0.5 font-medium text-fg">{f.title}</p>
            <p className="mt-1 text-fg/75">{f.explanation}</p>
            {f.sourceUrl && (
              <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12px] text-muted hover:text-fg">
                Source ↗
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Links({ r }: { r: CandidateResearch }) {
  const links = [
    r.website && { label: "Website", url: r.website },
    r.ballotpedia && { label: "Ballotpedia", url: r.ballotpedia },
    ...r.socials,
  ].filter(Boolean) as { label: string; url: string }[];
  if (!links.length && !r.news.length && !r.sources.length) return null;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      {links.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-[12px] text-muted hover:text-fg">
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
      {(r.news.length > 0 || r.sources.length > 0) && (
        <details className="group text-[12px]">
          <summary className="cursor-pointer list-none text-muted hover:text-fg">
            <span className="group-open:hidden">News & sources ({r.news.length + r.sources.length})</span>
            <span className="hidden group-open:inline">Hide news & sources</span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {r.news.map((n) => (
              <li key={n.url}>
                <a href={n.url} target="_blank" rel="noreferrer" className="text-fg/80 hover:text-fg">
                  {n.title}
                </a>
                <span className="text-faint">
                  {" "}
                  · {n.source}
                  {n.date ? ` · ${n.date}` : ""}
                </span>
              </li>
            ))}
            {r.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-faint hover:text-fg">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
