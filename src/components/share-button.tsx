"use client";

import { useEffect, useRef, useState } from "react";
import type { ShareSnapshot } from "@/lib/share-schema";
import { apiHeaders } from "@/lib/device";
import { useBallot } from "@/lib/store";
import { Button } from "./ui";

/** Saves the ballot and its finished research on the server and shows a link to it. */
export function ShareButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [includePicks, setIncludePicks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const create = async () => {
    const { ballot, candidates, measures, choices } = useBallot.getState();
    if (!ballot) return;
    setBusy(true);
    setError(null);
    try {
      const doneData = <T,>(jobs: Record<string, { status: string; data?: T }>) =>
        Object.fromEntries(Object.entries(jobs).flatMap(([k, j]) => (j.status === "done" && j.data ? [[k, j.data]] : [])));
      const snapshot: ShareSnapshot = {
        ballot: {
          electionName: ballot.electionName,
          electionDate: ballot.electionDate,
          state: ballot.state,
          county: ballot.county,
          jurisdiction: ballot.jurisdiction,
          contests: ballot.contests,
        },
        candidates: doneData(candidates) as ShareSnapshot["candidates"],
        measures: doneData(measures) as ShareSnapshot["measures"],
        ...(includePicks ? { choices } : {}),
      };
      const res = await fetch("/api/share", {
        method: "POST",
        headers: apiHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(snapshot),
      });
      const json = await res.json().catch(() => ({ error: `Couldn't create link (${res.status})` }));
      if (!res.ok) throw new Error(json.error);
      setLink(`${window.location.origin}${json.path}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create link");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the link is selectable */
    }
  };

  return (
    <div className="relative" ref={root}>
      <Button variant={variant} onClick={() => setOpen(!open)} aria-expanded={open}>
        Share
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-surface p-4 text-[13px] shadow-2xl shadow-black/50">
          <p className="font-medium">Share this ballot&apos;s research</p>
          <p className="mt-1 text-muted">
            Anyone with the link can open it and compare without re-researching. Your uploaded file isn&apos;t shared.
          </p>
          {!link ? (
            <>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-fg/90">
                <input
                  type="checkbox"
                  checked={includePicks}
                  onChange={(e) => setIncludePicks(e.target.checked)}
                  className="h-4 w-4 accent-[#5e6ad2]"
                />
                Include my picks
              </label>
              <Button variant="primary" className="mt-3 w-full" onClick={create} disabled={busy}>
                {busy ? "Creating link…" : "Create link"}
              </Button>
            </>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 font-mono text-[12px] text-fg"
              />
              <Button variant="primary" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
          {error && <p className="mt-2 text-bad">{error}</p>}
        </div>
      )}
    </div>
  );
}
