import "server-only";
import { randomBytes } from "node:crypto";
import { get, put } from "@vercel/blob";
import type { ShareSnapshot, StoredShare } from "./share-schema";

/** Shared ballots live in the same private Blob store as the research cache. */

const pathFor = (id: string) => `shares/${id}.json`;
const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
// Local development without a Blob store: keep shares in memory.
// (On globalThis because route handlers and pages may be bundled separately.)
const g = globalThis as { __ballotShares?: Map<string, string> };
const devStore =
  process.env.NODE_ENV !== "production" || process.env.MOCK_AI === "1" ? (g.__ballotShares ??= new Map()) : null;
export const sharingEnabled = () => hasBlob() || devStore !== null;
const ID = /^[A-Za-z0-9_-]{8,24}$/;

export async function createShare(snapshot: ShareSnapshot): Promise<string> {
  const id = randomBytes(9).toString("base64url");
  const stored: StoredShare = { v: 1, createdAt: new Date().toISOString(), ...snapshot };
  const body = JSON.stringify(stored);
  if (!hasBlob()) devStore?.set(id, body);
  else await put(pathFor(id), body, { access: "private", addRandomSuffix: false, contentType: "application/json" });
  return id;
}

export async function readShare(id: string): Promise<StoredShare | null> {
  if (!sharingEnabled() || !ID.test(id)) return null;
  try {
    if (!hasBlob()) {
      const body = devStore?.get(id);
      return body ? (JSON.parse(body) as StoredShare) : null;
    }
    const res = await get(pathFor(id), { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    return JSON.parse(await new Response(res.stream).text()) as StoredShare;
  } catch (err) {
    console.warn("share read failed", err);
    return null;
  }
}
