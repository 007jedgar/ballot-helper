"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button, Spinner, buttonClass } from "@/components/ui";
import { mergeBallots, prepareUploads } from "@/lib/prepare-file";
import type { BallotExtract } from "@/lib/schema";
import { useBallot, useHydrated } from "@/lib/store";

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

  const upload = useCallback(
    async (raw: File) => {
      setError(null);
      setBusy(true);
      try {
        const uploads = await prepareUploads(raw);
        const parts: BallotExtract[] = new Array(uploads.length);
        let done = 0;
        setProgress({ done, total: uploads.length });
        const readPage = async (i: number) => {
          const form = new FormData();
          form.append("file", uploads[i]);
          const res = await fetch("/api/parse-ballot", { method: "POST", body: form });
          const json = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
          if (!res.ok) throw new Error(uploads.length > 1 ? `Page ${i + 1}: ${json.error}` : json.error);
          parts[i] = json.ballot;
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
        setBallot(ballot, raw.name);
        router.push("/research");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [router, setBallot],
  );

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
                {progress && progress.total > 1
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
            </>
          )}
        </div>
        {error && <p className="mt-4 text-sm text-bad">{error}</p>}

        {hydrated && existing && !busy && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">Continue where you left off</p>
              <p className="text-[13px] text-muted">
                {existingName} · {existing.contests.length} items
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={reset}>
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
