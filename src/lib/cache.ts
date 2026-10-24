import "server-only";
import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";

/**
 * Shared 30-day cache of finished research, stored in a private Vercel Blob
 * store, so the same candidate or measure isn't researched again for every
 * user or device. Disabled (every call a miss) when no Blob store is connected.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_DAYS = 30;
const enabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

/** Stable blob path for a research subject; fields are normalized so spacing/case/punctuation don't matter. */
export function cachePath(kind: "candidate" | "measure", fields: Record<string, string | null | undefined>) {
  const canonical = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${norm(fields[k])}`)
    .join("|");
  return `research/v1/${kind}/${createHash("sha256").update(canonical).digest("hex")}.json`;
}

/** A cached result and what it cost to produce originally (null for older entries). */
export type CacheEntry<T> = { data: T; cost: number | null };

export async function readCache<T>(path: string): Promise<CacheEntry<T> | null> {
  if (!enabled()) return null;
  try {
    // Bypass the CDN so an entry refreshed after expiry is seen right away.
    const res = await get(path, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return null;
    const entry = JSON.parse(await new Response(res.stream).text()) as { data: T; cost?: number; ttlDays?: number };
    if (Date.now() - res.blob.uploadedAt.getTime() > (entry.ttlDays ?? TTL_DAYS) * DAY_MS) return null;
    return { data: entry.data, cost: entry.cost ?? null };
  } catch (err) {
    console.warn("research cache read failed", err);
    return null;
  }
}

/** `ttlDays` shortens the default 30 days, e.g. for thin results worth refreshing sooner. */
export async function writeCache(path: string, data: unknown, cost: number | null, ttlDays = TTL_DAYS) {
  if (!enabled()) return;
  try {
    await put(path, JSON.stringify({ data, ttlDays, ...(cost != null ? { cost } : {}) }), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  } catch (err) {
    console.warn("research cache write failed", err);
  }
}
