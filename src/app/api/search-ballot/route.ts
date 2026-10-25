import { z } from "zod";
import { checkBudget, rateLimit, recordSpend, sameSite } from "@/lib/abuse";
import { analyzeNotes, gatherNotes } from "@/lib/ai";
import { BALLOT_SEARCH_STRUCTURE, BALLOT_SEARCH_SYSTEM, areaOf, ballotSearchTask } from "@/lib/ballot-search";
import { cachePath, readCache, writeCache } from "@/lib/cache";
import { costed, errorResponse } from "@/lib/http";
import { mockBallot, mockEnabled } from "@/lib/mock";
import { BallotSchema, type BallotExtract } from "@/lib/schema";

export const maxDuration = 300;

const Body = z.object({
  address: z.string().min(5).max(200),
  /** Step 2: notes returned by step 1. Without them, this request gathers notes. */
  notes: z.string().max(200_000).optional(),
  gatherCost: z.number().min(0).max(100).nullish(),
});

// Ballots change as races are certified, so cached lookups expire quickly.
const TTL_DAYS = 3;

export async function POST(req: Request) {
  const crossSite = sameSite(req);
  if (crossSite) return crossSite;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Enter your full home address or ZIP code." }, { status: 400 });
  const { address, notes, gatherCost } = body.data;
  const where = areaOf(address);
  if (!where) return Response.json({ error: "Include your city and state, or your ZIP code." }, { status: 400 });
  const area = where.zip ?? where.area;
  try {
    if (mockEnabled()) {
      if (!notes) return Response.json({ notes: "mock notes", cost: 0.08 });
      return Response.json({ ballot: await mockBallot(), area: where.area, cost: 0.12 });
    }
    const path = cachePath("ballot", { area });
    if (!notes) {
      const cached = await readCache<BallotExtract>(path);
      if (cached) return Response.json({ ballot: cached.data, area: where.area, cached: true, cost: cached.cost });
    }
    // Same limits as reading an uploaded ballot; only gathering is stopped by the daily budget.
    const blocked = (await rateLimit(req, "parse")) ?? (notes ? null : await checkBudget());
    if (blocked) return blocked;
    const task = ballotSearchTask(where.area, new Date().toISOString().slice(0, 10));
    if (!notes) {
      return Response.json(await costed("ballot-search", await gatherNotes(BALLOT_SEARCH_SYSTEM, task, { searches: 8, fetches: 5 }), "notes"));
    }
    const analyzed = await analyzeNotes(BallotSchema, { task, notes, structureHint: BALLOT_SEARCH_STRUCTURE, tier: "candidate", effort: "low" });
    await recordSpend(analyzed.cost);
    const ballot = analyzed.value;
    const cost = analyzed.cost == null ? null : analyzed.cost + (gatherCost ?? 0);
    if (ballot.contests.length) await writeCache(path, ballot, cost, TTL_DAYS);
    return Response.json({ ballot, area: where.area, cost });
  } catch (err) {
    return errorResponse(err);
  }
}
