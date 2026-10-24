"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NoBallot } from "@/components/empty-state";
import { Button } from "@/components/ui";
import { exportBallotPdf } from "@/lib/export-pdf";
import { useBallot, useHydrated } from "@/lib/store";

export default function ReviewPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const ballot = useBallot((s) => s.ballot);
  const choices = useBallot((s) => s.choices);
  const setStep = useBallot((s) => s.setStep);
  const [busy, setBusy] = useState(false);
  if (!hydrated) return null;
  if (!ballot) return <NoBallot />;

  const made = ballot.contests.filter((c) => (choices[c.id] ?? []).length).length;

  const download = async () => {
    setBusy(true);
    try {
      const bytes = await exportBallotPdf(ballot, choices);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-sample-ballot${ballot.electionDate ? `-${ballot.electionDate}` : ""}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
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
        <div className="flex gap-2">
          <Button onClick={() => window.print()}>Print</Button>
          <Button variant="primary" onClick={download} disabled={busy}>
            Download PDF
          </Button>
        </div>
      </div>

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
