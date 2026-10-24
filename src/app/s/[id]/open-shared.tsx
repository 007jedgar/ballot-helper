"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { clearOriginal } from "@/lib/file-store";
import type { ShareSnapshot } from "@/lib/share-schema";
import { useBallot, useHydrated } from "@/lib/store";

export function OpenShared({ id }: { id: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const hasBallot = useBallot((s) => !!s.ballot);
  const importShare = useBallot((s) => s.importShare);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${id}`);
      const json = await res.json().catch(() => ({ error: `Couldn't load (${res.status})` }));
      if (!res.ok) throw new Error(json.error);
      importShare(json as ShareSnapshot);
      // The recipient doesn't have the sharer's original file.
      await clearOriginal();
      router.push("/compare");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open this ballot");
      setBusy(false);
    }
  };

  return (
    <div>
      <Button variant="primary" className="h-10 px-5 text-sm" onClick={open} disabled={busy || !hydrated}>
        {busy ? "Opening…" : "Open this ballot →"}
      </Button>
      {hydrated && hasBallot && (
        <p className="mt-3 text-[13px] text-muted">This replaces the ballot you&apos;re working on in this browser.</p>
      )}
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
    </div>
  );
}
