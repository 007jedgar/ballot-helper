import { z } from "zod";
import { researchStructured } from "@/lib/ai";
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
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  try {
    if (mockEnabled()) return Response.json({ research: await mockMeasure(body.data.title) });
    const research = await researchStructured(MeasureResearchSchema, {
      system: RESEARCH_SYSTEM,
      task: measureTask(body.data),
      structureHint: MEASURE_STRUCTURE,
    });
    return Response.json({ research });
  } catch (err) {
    return errorResponse(err);
  }
}
