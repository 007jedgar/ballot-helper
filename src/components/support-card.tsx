"use client";

import { useBallotCost } from "@/lib/research";
import { useBallot } from "@/lib/store";
import { SUPPORT_AMOUNTS, SUPPORT_URL, supportEnabled } from "@/lib/support";
import { buttonClass } from "./ui";

/**
 * A quiet, once-per-ballot ask shown after the voter exports. Never blocks
 * anything, and closing it (or clicking through) hides it for this ballot.
 */
export function SupportCard() {
  const exported = useBallot((s) => s.exported);
  const dismissed = useBallot((s) => s.supportDismissed);
  const dismiss = useBallot((s) => s.dismissSupport);
  const cost = useBallotCost();
  if (!supportEnabled || !exported || dismissed) return null;

  const link = (url: string, label: string, primary = false) => (
    <a
      key={label}
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={dismiss}
      className={buttonClass(primary ? "primary" : "secondary", "h-8 px-3")}
    >
      {label}
    </a>
  );

  return (
    <aside className="mb-6 rounded-xl border border-line bg-surface p-4 text-[13px] print:hidden" aria-label="Support Ballot Helper">
      <div className="flex items-start justify-between gap-4">
        <p className="leading-relaxed text-fg/90">
          Ballot Helper is free, nonpartisan, and has no ads.
          {cost >= 0.05 && <> The AI research behind this ballot cost about ${cost.toFixed(2)}.</>} If it helped, you can chip in
          to keep it running.
        </p>
        <button onClick={dismiss} className="shrink-0 text-muted hover:text-fg" aria-label="No thanks">
          No thanks
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUPPORT_AMOUNTS.map((a) => link(a.url, `$${a.amount}`, a.suggested))}
        {SUPPORT_URL && link(SUPPORT_URL, SUPPORT_AMOUNTS.length ? "Other amount" : "Chip in (suggested $5)", !SUPPORT_AMOUNTS.length)}
      </div>
      <p className="mt-3 text-[11px] text-faint">
        Payments are handled by Stripe. Contributions support running this tool and aren&apos;t tax-deductible.
      </p>
    </aside>
  );
}

/** Small always-available footer link. */
export function SupportFooterLink() {
  const url = SUPPORT_URL ?? SUPPORT_AMOUNTS.find((a) => a.suggested)?.url ?? SUPPORT_AMOUNTS[0]?.url;
  if (!url) return null;
  return (
    <>
      {" · "}
      <a href={url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-muted hover:underline">
        Support this project
      </a>
    </>
  );
}
