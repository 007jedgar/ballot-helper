"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button, Spinner, buttonClass } from "@/components/ui";
import { clearOriginal, saveOriginal } from "@/lib/file-store";
import { mergeBallots, prepareUploads } from "@/lib/prepare-file";
import type { BallotExtract } from "@/lib/schema";
import { apiHeaders } from "@/lib/device";
import { useBallot, useHydrated } from "@/lib/store";

const addressLookup = process.env.NEXT_PUBLIC_ADDRESS_LOOKUP === "1";

export default function UploadPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const existing = useBallot((s) => s.ballot);
  const existingName = useBallot((s) => s.fileName);
  const setBallot = useBallot((s) => s.setBallot);
  const reset = useBallot((s) => s.reset);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [noData, setNoData] = useState(false);

  const upload = useCallback(
    async (raw: File) => {
      setError(null);
      setBusy(true);
      try {
        const uploads = await prepareUploads(raw);
        const parts: BallotExtract[] = new Array(uploads.length);
        let done = 0;
        let parseCost = 0;
        setProgress({ done, total: uploads.length });
        const readPage = async (i: number) => {
          const form = new FormData();
          form.append("file", uploads[i]);
          const res = await fetch("/api/parse-ballot", { method: "POST", body: form, headers: apiHeaders() });
          const json = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
          if (!res.ok) throw new Error(uploads.length > 1 ? `Page ${i + 1}: ${json.error}` : json.error);
          parts[i] = json.ballot;
          parseCost += typeof json.cost === "number" ? json.cost : 0;
          setProgress({ done: ++done, total: uploads.length });
        };
        // A few pages at a time keeps us under provider rate limits.
        const queue = uploads.map((_, i) => i);
        await Promise.all(
          Array.from({ length: Math.min(3, queue.length) }, async () => {
            for (let i = queue.shift(); i !== undefined; i = queue.shift()) await readPage(i);
          }),
        );
        const ballot = mergeBallots(parts);
        if (!ballot.contests.length) throw new Error("No contests found. Is this a sample ballot?");
        await saveOriginal(raw);
        setBallot(ballot, raw.name, parseCost);
        router.push("/setup");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [router, setBallot],
  );

  const lookup = async () => {
    setError(null);
    setNoData(false);
    setBusy(true);
    try {
      const res = await fetch("/api/lookup-ballot", {
        method: "POST",
        body: JSON.stringify({ address }),
        headers: { ...apiHeaders(), "content-type": "application/json" },
      });
      const json = await res.json().catch(() => ({ error: `Lookup failed (${res.status})` }));
      if (!res.ok) {
        setNoData(res.status === 404);
        throw new Error(json.error);
      }
      const ballot: BallotExtract = json.ballot;
      // No original file to fill in, so the review page offers the generated PDF.
      await clearOriginal();
      setBallot(ballot, ballot.electionName ?? "Sample ballot", 0);
      router.push("/setup");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glow">
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-20 sm:px-6 sm:pt-28">
        <p className="mb-4 text-[13px] text-muted">Nonpartisan research for every line on your ballot</p>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">
          Know who you&apos;re voting for.
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-muted">
          Upload your sample ballot. We research every candidate and measure across Ballotpedia, campaign sites, social
          media, endorsements and the press, then walk you through each choice.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f && !busy) void upload(f);
          }}
          onClick={() => !busy && input.current?.click()}
          className={`mt-12 cursor-pointer rounded-2xl border border-dashed p-10 text-center transition-colors ${
            dragging ? "border-accent bg-accent/5" : "border-line-strong bg-surface/60 hover:border-muted/50"
          }`}
        >
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          {busy ? (
            <div className="flex flex-col items-center gap-3 text-muted">
              <Spinner className="h-5 w-5" />
              <p className="text-sm">
                {!progress
                  ? "Looking up your ballot…"
                  : progress.total > 1
                    ? `Reading your ballot… ${progress.done}/${progress.total} pages`
                    : "Reading your ballot… this can take a minute."}
              </p>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface-2 text-muted">
                ↑
              </div>
              <p className="text-sm font-medium">Drop your sample ballot here</p>
              <p className="mt-1 text-[13px] text-faint">PDF, screenshot, or photo · stays in your browser except for analysis</p>
              <p className="mt-3 text-[11px] text-faint">
                By uploading you agree to the{" "}
                <Link href="/terms" onClick={(e) => e.stopPropagation()} className="underline underline-offset-2 hover:text-muted">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" onClick={(e) => e.stopPropagation()} className="underline underline-offset-2 hover:text-muted">
                  Privacy Policy
                </Link>
                .
              </p>
            </>
          )}
        </div>

        {addressLookup && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && address.trim()) void lookup();
            }}
            className="mt-4"
          >
            <label htmlFor="address" className="text-[13px] text-muted">
              No sample ballot handy? Look it up by your home address.
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="address"
                type="text"
                autoComplete="street-address"
                placeholder="123 Main St, Columbus, OH 43215"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={busy}
                className="h-9 w-full min-w-0 rounded-lg sm:flex-1 border border-line bg-surface px-3 text-[13px] placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <Button type="submit" variant="secondary" disabled={busy || !address.trim()}>
                Find my ballot
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-faint">
              Your address is sent to Google&apos;s Civic Information API for this lookup and isn&apos;t stored. Coverage
              depends on your county.
            </p>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-bad">{error}</p>}
        {noData && (
          <p className="mt-2 text-[13px] text-muted">
            Try{" "}
            <a href="https://www.vote411.org/ballot" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fg">
              VOTE411
            </a>{" "}
            or{" "}
            <a href="https://ballotpedia.org/Sample_Ballot_Lookup" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fg">
              Ballotpedia
            </a>{" "}
            or your county elections office&apos;s website. Save or screenshot your sample ballot there, then upload it above.
          </p>
        )}

        {hydrated && existing && !busy && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">Continue where you left off</p>
              <p className="text-[13px] text-muted">
                {existingName} · {existing.contests.length} items
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  void clearOriginal();
                }}
              >
                Clear
              </Button>
              <Link href="/compare" className={buttonClass("primary")}>
                Resume
              </Link>
            </div>
          </div>
        )}

        <ol className="mt-20 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {[
            ["Upload", "We read every race, judge, and measure on your ballot."],
            ["Research", "Qualifications, positions, endorsements, record and criticism."],
            ["Decide", "Compare side by side, pick, and export a marked sample ballot."],
          ].map(([title, body], i) => (
            <li key={title} className="bg-surface p-5">
              <p className="font-mono text-[11px] text-faint">0{i + 1}</p>
              <p className="mt-2 text-sm font-medium">{title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
