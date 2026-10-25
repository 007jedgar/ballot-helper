import "server-only";
import { createHash } from "node:crypto";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Abuse protection for the API routes:
 * - per-IP and per-device limits (devices are a random ID the browser keeps;
 *   IP limits are looser because many voters can share one IP)
 * - a daily cap on total AI spend
 * - a same-site check so other websites can't drive the API from a browser
 *
 * Counters live in Upstash Redis when connected (UPSTASH_REDIS_REST_* or the
 * KV_REST_API_* vars Vercel's Upstash integration sets); otherwise in this
 * server instance's memory, which still blunts bursts but isn't global.
 * IPs and device IDs are only ever stored as salted hashes.
 */

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

type Kind = "parse" | "lookup" | "research" | "share";
type Rule = { device: number; ip: number; window: Duration; label: string };

const RULES: Record<Kind, Rule> = {
  // Ballot pages read (a ballot is usually 1-6 pages).
  parse: { device: 40, ip: 150, window: "1 h", label: "ballot uploads" },
  // Address lookups (no AI cost, but each one spends Google API quota).
  lookup: { device: 20, ip: 100, window: "1 h", label: "address lookups" },
  // New research requests (each candidate is 2: gather + analyze). Cache hits don't count.
  research: { device: 800, ip: 3000, window: "1 d", label: "research requests" },
  share: { device: 20, ip: 60, window: "1 h", label: "share links" },
};

const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 100);
const SALT = process.env.RATE_LIMIT_SALT ?? "ballot-helper";
const hash = (v: string) => createHash("sha256").update(`${SALT}:${v}`).digest("hex").slice(0, 32);

const limiters = new Map<string, Ratelimit>();
function upstash(kind: Kind, who: "device" | "ip") {
  const key = `${kind}:${who}`;
  let l = limiters.get(key);
  if (!l && redis) {
    const rule = RULES[kind];
    l = new Ratelimit({ redis, prefix: `bh:rl:${key}`, limiter: Ratelimit.fixedWindow(rule[who], rule.window) });
    limiters.set(key, l);
  }
  return l;
}

// In-memory fallback: fixed windows per key.
const memory = new Map<string, { count: number; resetAt: number }>();
const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
function memoryLimit(key: string, limit: number, window: Duration) {
  const [n, unit] = window.split(" ");
  const now = Date.now();
  let entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + Number(n) * UNIT_MS[unit] };
    memory.set(key, entry);
  }
  entry.count++;
  if (memory.size > 50_000) memory.clear(); // bound memory on a long-lived instance
  return { success: entry.count <= limit, reset: entry.resetAt };
}

function clientIds(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const device = req.headers.get("x-device-id");
  return { ip: hash(ip), device: device && /^[A-Za-z0-9-]{8,64}$/.test(device) ? hash(device) : null };
}

function tooMany(message: string, resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

/** Returns a 429 response if this client is over its limit for `kind`, else null (and counts the request). */
export async function rateLimit(req: Request, kind: Kind): Promise<Response | null> {
  const rule = RULES[kind];
  const ids = clientIds(req);
  // Requests without a device ID only get the device-sized allowance on their IP.
  const checks: ["device" | "ip", string, number][] = [
    ["ip", ids.ip, ids.device ? rule.ip : rule.device],
    ...(ids.device ? [["device", ids.device, rule.device] as ["device", string, number]] : []),
  ];
  for (const [who, id, limit] of checks) {
    const l = upstash(kind, who);
    const res = l ? await l.limit(id) : memoryLimit(`${kind}:${who}:${id}`, limit, rule.window);
    if (!res.success) {
      return tooMany(`You've hit the limit on ${rule.label} for now. Please try again later.`, res.reset);
    }
  }
  return null;
}

const dayKey = () => `bh:spend:${new Date().toISOString().slice(0, 10)}`;
let memorySpend = { day: "", usd: 0 };

/** Returns a 429 response once today's total AI spend has reached DAILY_BUDGET_USD, else null. */
export async function checkBudget(): Promise<Response | null> {
  if (!(DAILY_BUDGET_USD > 0)) return null;
  const key = dayKey();
  const spent = redis ? Number((await redis.get<number>(key)) ?? 0) : memorySpend.day === key ? memorySpend.usd : 0;
  if (spent < DAILY_BUDGET_USD) return null;
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return tooMany(
    "Ballot Helper has reached today's research budget. Results other voters already researched still load; new research resumes tomorrow.",
    midnight.getTime(),
  );
}

/** Adds to today's AI spend (no-op for unknown costs). */
export async function recordSpend(usd: number | null | undefined) {
  if (!usd || usd <= 0) return;
  const key = dayKey();
  if (redis) {
    await redis.incrbyfloat(key, usd);
    await redis.expire(key, 3 * 86_400);
  } else {
    memorySpend = memorySpend.day === key ? { day: key, usd: memorySpend.usd + usd } : { day: key, usd };
  }
}

/** Rejects cross-site browser requests: POSTs must come from this site's own pages. */
export function sameSite(req: Request): Response | null {
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const ok = site ? site === "same-origin" : Boolean(origin && host && new URL(origin).host === host);
  return ok ? null : Response.json({ error: "Requests must come from the Ballot Helper site." }, { status: 403 });
}
