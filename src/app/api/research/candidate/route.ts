import { z } from "zod";
import { researchStructured } from "@/lib/ai";
import { errorResponse } from "@/lib/http";
import { mockCandidate, mockEnabled } from "@/lib/mock";
import { CANDIDATE_STRUCTURE, RESEARCH_SYSTEM, candidateTask } from "@/lib/prompts";
import { CandidateResearchSchema } from "@/lib/schema";

export const maxDuration = 300;

const Body = z.object({
  name: z.string().min(1),
  party: z.string().nullish(),
  office: z.string().min(1),
  district: z.string().nullish(),
  isJudicial: z.boolean().default(false),
  otherCandidates: z.array(z.string()).default([]),
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
    if (mockEnabled()) {
      return Response.json({ research: await mockCandidate(body.data.name, body.data.party, body.data.isJudicial) });
    }
    const research = await researchStructured(CandidateResearchSchema, {
      system: RESEARCH_SYSTEM,
      task: candidateTask(body.data),
      structureHint: CANDIDATE_STRUCTURE,
      tier: "candidate",
    });
    return Response.json({ research });
  } catch (err) {
    return errorResponse(err);
  }
}
