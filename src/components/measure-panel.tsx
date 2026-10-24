"use client";

import type { MeasureResearch } from "@/lib/schema";
import type { Job } from "@/lib/store";
import { Bullets } from "./bullets";
import { Badge, Button } from "./ui";

export function MeasurePanel({
  job,
  text,
  onRetry,
  skipped,
}: {
  job: Job<MeasureResearch>;
  text: string | null;
  onRetry: () => void;
  skipped?: { reason: string; onResearch: () => void };
}) {
  const r = job.data;
  if (job.status === "idle" && skipped) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 text-[13px]">
        <p className="text-muted">{skipped.reason}</p>
        {text && <p className="mt-3 whitespace-pre-line leading-relaxed text-fg/80">{text}</p>}
        <Button variant="ghost" className="mt-3 h-7 px-2 text-[12px]" onClick={skipped.onResearch}>
          Research this measure
        </Button>
      </div>
    );
  }
  if (job.status === "error") {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 text-[13px]">
        <p className="text-bad">{job.error}</p>
        <Button variant="ghost" className="mt-2 h-7 px-2 text-[12px]" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (job.status !== "done" || !r) {
    return (
      <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <p className="text-[12px] text-faint">Analyzing measure…</p>
        {[90, 75, 85, 60].map((w, i) => (
          <div key={i} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">What a yes vote does</p>
          {r.confidence === "low" && <Badge tone="warn">Limited info</Badge>}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed">{r.plainSummary}</p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          <span className="text-faint">Today: </span>
          {r.currentLaw}
        </p>
        {r.fiscalImpact && (
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            <span className="text-faint">Fiscal impact: </span>
            {r.fiscalImpact}
          </p>
        )}
        {text && (
          <details className="mt-3 text-[12px]">
            <summary className="cursor-pointer text-muted hover:text-fg">Ballot text</summary>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-faint">{text}</p>
          </details>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-5 rounded-xl border border-line bg-surface p-5">
          <p className="text-sm font-medium text-good">If it passes</p>
          <Bullets title="Effects" items={r.ifPasses} limit={6} />
          <Bullets title="Arguments for" items={r.argumentsFor} tone="good" />
          <Bullets title="Supporters" items={r.supporters} limit={3} />
        </section>
        <section className="space-y-5 rounded-xl border border-line bg-surface p-5">
          <p className="text-sm font-medium text-bad">If it fails</p>
          <Bullets title="Effects" items={r.ifFails} limit={6} />
          <Bullets title="Arguments against" items={r.argumentsAgainst} tone="bad" />
          <Bullets title="Opponents" items={r.opponents} limit={3} />
        </section>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">Critical analysis</p>
        <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-fg/90">{r.criticalAnalysis}</p>
        {r.sources.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-4">
            {r.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="text-[12px] text-muted hover:text-fg">
                {s.label} ↗
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
