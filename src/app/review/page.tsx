"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NoBallot } from "@/components/empty-state";
import { ShareButton } from "@/components/share-button";
import { SupportCard } from "@/components/support-card";
import { Button } from "@/components/ui";
import { exportBallotPdf } from "@/lib/export-pdf";
import { loadOriginal } from "@/lib/file-store";
import { canMark, markOriginal, type MarkReport } from "@/lib/mark-original";
import { PARTIES, PARTY_LABELS, partyOf, type Party } from "@/lib/prefs";
import { useBallot, useHydrated } from "@/lib/store";

export default function ReviewPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const ballot = useBallot((s) => s.ballot);
  const choices = useBallot((s) => s.choices);
  const setStep = useBallot((s) => s.setStep);
  const markExported = useBallot((s) => s.markExported);
  const [busy, setBusy] = useState(false);
  const [original, setOriginal] = useState<File | null>(null);
  const [marking, setMarking] = useState(false);
  const [markResult, setMarkResult] = useState<MarkReport | string | null>(null);
  const applyStraightTicket = useBallot((s) => s.applyStraightTicket);
  const [ticket, setTicket] = useState<{ party: Party; races: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const file = await loadOriginal();
      if (file && !cancelled && (await canMark(file).catch(() => false)) && !cancelled) setOriginal(file);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated) return null;
  if (!ballot) return <NoBallot />;

  const made = ballot.contests.filter((c) => (choices[c.id] ?? []).length).length;

  const save = (bytes: Uint8Array, name: string) => {
    markExported();
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const download = async () => {
    setBusy(true);
    try {
      save(await exportBallotPdf(ballot, choices), `my-sample-ballot${ballot.electionDate ? `-${ballot.electionDate}` : ""}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const fillOriginal = async () => {
    if (!original) return;
    setMarking(true);
    setMarkResult(null);
    try {
      const { bytes, report } = await markOriginal(original, ballot, choices);
      save(bytes, original.name.replace(/\.pdf$/i, "") + "-marked.pdf");
      setMarkResult(report);
    } catch (e) {
      setMarkResult(e instanceof Error ? e.message : "Couldn't mark the original ballot.");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 print:max-w-none print:p-0">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your sample ballot</h1>
          <p className="mt-1 text-[13px] text-muted">
            {made} of {ballot.contests.length} decided. Bring this with you to the polls.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ShareButton />
          <Button
            onClick={() => {
              markExported();
              window.print();
            }}
          >
            Print
          </Button>
          <Button variant={original ? "secondary" : "primary"} onClick={download} disabled={busy}>
            Download PDF
          </Button>
          {original && (
            <Button variant="primary" onClick={fillOriginal} disabled={marking || made === 0}>
              {marking ? "Filling in…" : "Fill in my original ballot"}
            </Button>
          )}
        </div>
      </div>

      {(() => {
        const parties = PARTIES.filter((p) => ballot.contests.some((c) => c.candidates.some((x) => partyOf(x.party) === p)));
        if (!parties.length) return null;
        return (
          <div className="mb-6 rounded-xl border border-line bg-surface p-4 text-[13px] print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 font-medium">Straight ticket</span>
              {parties.map((p) => (
                <Button
                  key={p}
                  variant={ticket?.party === p ? "primary" : "secondary"}
                  className="h-8 px-3"
                  onClick={() => setTicket({ party: p, races: applyStraightTicket(p) })}
                >
                  {PARTY_LABELS[p]}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-muted">
              {ticket
                ? `Selected ${PARTY_LABELS[ticket.party]} candidates in ${ticket.races} race${ticket.races === 1 ? "" : "s"}. Nonpartisan races and measures were left as they were.`
                : "Selects one party's candidates in every partisan race. Nonpartisan races and measures are left for you to decide."}
            </p>
          </div>
        );
      })()}

      {markResult && (
        <div className="mb-6 rounded-xl border border-line bg-surface p-4 text-[13px] print:hidden">
          {typeof markResult === "string" ? (
            <p className="text-bad">{markResult}</p>
          ) : (
            <>
              <p>
                Marked {markResult.filled + markResult.checked} selection{markResult.filled + markResult.checked === 1 ? "" : "s"} on{" "}
                {original?.name}.
                {markResult.checked > 0 && (
                  <span className="text-muted"> {markResult.checked} got a check mark because no box was found next to the name.</span>
                )}{" "}
                <span className="text-muted">Double-check it before relying on it.</span>
              </p>
              {markResult.missing.length > 0 && (
                <div className="mt-2 text-warn">
                  Couldn&apos;t find these on the original, so mark them by hand:
                  <ul className="mt-1 list-disc pl-5 text-fg/80">
                    {markResult.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <SupportCard />

      <div className="rounded-xl bg-white p-6 text-[#16171a] shadow-[0_0_0_1px_rgb(255_255_255/0.1)] sm:p-10 print:rounded-none print:p-0 print:shadow-none">
        <h2 className="text-xl font-semibold tracking-tight">My Sample Ballot</h2>
        <p className="mt-1 text-[13px] text-[#6b6f76]">
          {[ballot.electionName, ballot.electionDate, ballot.jurisdiction ?? ballot.county, ballot.state].filter(Boolean).join(" · ")}
        </p>
        <ol className="mt-6 divide-y divide-[#e6e7ea]">
          {ballot.contests.map((c, i) => {
            const picked = choices[c.id] ?? [];
            const rows =
              c.kind === "candidate"
                ? c.candidates.map((x) => ({ value: x.name, sub: x.party }))
                : (c.options.length ? c.options : ["Yes", "No"]).map((o) => ({ value: o, sub: null }));
            return (
              <li key={c.id} className="break-inside-avoid py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{c.title}</p>
                    <p className="text-[12px] text-[#6b6f76]">
                      {[c.district, c.kind === "retention" && `Retain ${c.candidates[0]?.name}?`, c.voteFor > 1 && `Vote for up to ${c.voteFor}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    className="text-[12px] text-[#5e6ad2] hover:underline print:hidden"
                    onClick={() => {
                      setStep(i);
                      router.push("/compare");
                    }}
                  >
                    Edit
                  </button>
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {rows.map((r) => {
                    const on = picked.includes(r.value);
                    return (
                      <li key={r.value} className={`flex items-center gap-3 text-[13px] ${on ? "font-semibold" : "text-[#6b6f76]"}`}>
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border text-[10px] text-white ${
                            on ? "border-[#5e6ad2] bg-[#5e6ad2] print:bg-black print:border-black" : "border-[#b4b7bd]"
                          }`}
                        >
                          {on && "✓"}
                        </span>
                        {r.value}
                        {r.sub && <span className="font-normal text-[#9a9ea6]">{r.sub}</span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-[11px] text-[#9a9ea6]">Personal reference only. Not an official ballot.</p>
      </div>
    </div>
  );
}
