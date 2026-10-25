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
export function cachePath(kind: "candidate" | "measure", fields: Record<string, string | null | undefined>, version = 1) {
  const canonical = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${norm(fields[k])}`)
    .join("|");
  return `research/v${version}/${kind}/${createHash("sha256").update(canonical).digest("hex")}.json`;
}

// The ballot is transcribed by a model, so the same race can come back as
// "Judge, 333rd District Court" one time and "District Judge, 333rd Judicial
// District" the next, and dates/states/counties in different formats. Cache
// keys (v2) only use fields that stay stable across readings, normalized hard.

const STATES: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca", colorado: "co", connecticut: "ct",
  delaware: "de", "district of columbia": "dc", florida: "fl", georgia: "ga", hawaii: "hi", idaho: "id", illinois: "il",
  indiana: "in", iowa: "ia", kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
  massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms", missouri: "mo", montana: "mt",
  nebraska: "ne", nevada: "nv", "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
  "north carolina": "nc", "north dakota": "nd", ohio: "oh", oklahoma: "ok", oregon: "or", pennsylvania: "pa",
  "rhode island": "ri", "south carolina": "sc", "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut",
  vermont: "vt", virginia: "va", washington: "wa", "west virginia": "wv", wisconsin: "wi", wyoming: "wy",
};
const stateKey = (s: string | null | undefined) => {
  const n = norm(s).replace(/^state of /, "");
  return STATES[n] ?? n;
};
const countyKey = (s: string | null | undefined) => norm(s).replace(/\b(county|parish|borough)\b/g, "").trim();
const yearOf = (s: string | null | undefined) => (s ?? "").match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
const FILLER = new Set(["the", "of", "for", "and", "a", "an", "no", "num", "number"]);
/** Order-independent word set, so "Proposition A, City of Houston" matches "City of Houston Proposition A". */
const wordsKey = (s: string) => [...new Set(norm(s).split(" ").filter((w) => w && !FILLER.has(w)))].sort().join(" ");

type Place = { state?: string | null; county?: string | null; electionDate?: string | null };
const placeFields = (p: Place) => ({ state: stateKey(p.state), county: countyKey(p.county), year: yearOf(p.electionDate) });

/** A person running in this election and place, whatever the office line was transcribed as. */
export const candidatePath = (name: string, place: Place, extra: Record<string, string> = {}) =>
  cachePath("candidate", { name, ...placeFields(place), ...extra }, 2);

/** A measure by its title and district words (its transcribed full text varies too much to key on). */
export const measurePath = (title: string, district: string | null | undefined, place: Place) =>
  cachePath("measure", { title: wordsKey(`${title} ${district ?? ""}`), ...placeFields(place) }, 2);

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
