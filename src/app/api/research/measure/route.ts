import { z } from "zod";
import { analyzeNotes, gatherNotes } from "@/lib/ai";
import { cachePath, readCache, writeCache } from "@/lib/cache";
import { errorResponse } from "@/lib/http";
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
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { notes, ...input } = body.data;
  try {
    if (mockEnabled()) {
      if (!notes) return Response.json({ notes: "mock notes" });
      return Response.json({ research: await mockMeasure(input.title) });
    }
    // Step 1 checks the shared cache first; a hit skips both steps.
    const path = cachePath("measure", {
      title: input.title,
      district: input.district,
      text: input.text,
      state: input.election.state,
      county: input.election.county,
      electionDate: input.election.electionDate,
    });
    if (!notes) {
      const cached = await readCache(path);
      if (cached) return Response.json({ research: cached, cached: true });
    }
    const task = measureTask(input);
    if (!notes) return Response.json({ notes: await gatherNotes(RESEARCH_SYSTEM, task) });
    const research = await analyzeNotes(MeasureResearchSchema, {
      task,
      notes,
      structureHint: MEASURE_STRUCTURE,
      tier: "measure",
    });
    if (research.confidence !== "low") await writeCache(path, research);
    return Response.json({ research });
  } catch (err) {
    return errorResponse(err);
  }
}
