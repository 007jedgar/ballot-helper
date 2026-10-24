import { z } from "zod";
import { analyzeNotes, gatherNotes } from "@/lib/ai";
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
      return Response.json({ research: await mockCandidate(input.name, input.party, input.isJudicial) });
    }
    const task = candidateTask(input);
    if (!notes) return Response.json({ notes: await gatherNotes(RESEARCH_SYSTEM, task) });
    const research = await analyzeNotes(CandidateResearchSchema, { task, notes, structureHint: CANDIDATE_STRUCTURE, tier: "candidate" });
    return Response.json({ research });
  } catch (err) {
    return errorResponse(err);
  }
}
