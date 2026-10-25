import { z } from "zod";
import { checkBudget, rateLimit, recordSpend, sameSite } from "@/lib/abuse";
import { analyzeNotes, gatherNotes } from "@/lib/ai";
import { cachePath, measurePath, readCache, writeCache } from "@/lib/cache";
import { costed, errorResponse } from "@/lib/http";
import { mockEnabled, mockMeasure } from "@/lib/mock";
import { MEASURE_STRUCTURE, RESEARCH_SYSTEM, measureTask } from "@/lib/prompts";
import { MeasureResearchSchema } from "@/lib/schema";

export const maxDuration = 300;

const Body = z.object({
  title: z.string().min(1),
  district: z.string().nullish(),
  text: z.string().nullish(),
  election: z
    .object({
      electionName: z.string().nullish(),
      electionDate: z.string().nullish(),
      state: z.string().nullish(),
      county: z.string().nullish(),
      jurisdiction: z.string().nullish(),
    })
    .default({}),
  /** Step 2: notes returned by step 1. Without them, this request gathers notes. */
  notes: z.string().max(200_000).optional(),
  /** Step 2: what step 1 cost, so the cached entry records the full cost. */
  gatherCost: z.number().min(0).max(100).nullish(),
});

export async function POST(req: Request) {
  const crossSite = sameSite(req);
  if (crossSite) return crossSite;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { notes, gatherCost, ...input } = body.data;
  try {
    if (mockEnabled()) {
      const limited = (await rateLimit(req, "research")) ?? (notes ? null : await checkBudget());
      if (limited) return limited;
      await recordSpend(notes ? 0.05 : 0.03);
      if (!notes) return Response.json({ notes: "mock notes", cost: 0.03 });
      return Response.json({ research: await mockMeasure(input.title), cost: 0.05 + (gatherCost ?? 0) });
    }
    // Step 1 checks the shared cache first; a hit skips both steps.
    const path = measurePath(input.title, input.district, input.election);
    if (!notes) {
      // Entries written before v2 keys (which included the full transcribed text) are still read.
      const legacy = cachePath("measure", {
        title: input.title,
        district: input.district,
        text: input.text,
        state: input.election.state,
        county: input.election.county,
        electionDate: input.election.electionDate,
      });
      const cached = (await readCache(path)) ?? (await readCache(legacy));
      if (cached) return Response.json({ research: cached.data, cached: true, cost: cached.cost });
    }
    // New (uncached) work: count it against limits; only gathering is stopped by the daily budget,
    // so a candidate whose notes were already gathered can still finish.
    const blocked = (await rateLimit(req, "research")) ?? (notes ? null : await checkBudget());
    if (blocked) return blocked;
    const task = measureTask(input);
    if (!notes) return Response.json(await costed("gather", await gatherNotes(RESEARCH_SYSTEM, task), "notes"));
    const analyzed = await analyzeNotes(MeasureResearchSchema, {
      task,
      notes,
      structureHint: MEASURE_STRUCTURE,
      tier: "measure",
    });
    await recordSpend(analyzed.cost);
    const research = analyzed.value;
    const cost = analyzed.cost == null ? null : analyzed.cost + (gatherCost ?? 0);
    await writeCache(path, research, cost, research.confidence === "low" ? 7 : undefined);
    return Response.json({ research, cost });
  } catch (err) {
    return errorResponse(err);
  }
}
