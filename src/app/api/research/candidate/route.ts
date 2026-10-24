import { z } from "zod";
import { analyzeNotes, gatherNotes } from "@/lib/ai";
import { cachePath, readCache, writeCache } from "@/lib/cache";
import { errorResponse } from "@/lib/http";
import { mockCandidate, mockEnabled } from "@/lib/mock";
import { TOPICS, isFullTopics, normalizeTopics } from "@/lib/prefs";
import { RESEARCH_SYSTEM, candidateStructure, candidateTask, researchBudget } from "@/lib/prompts";
import { CandidateResearchSchema } from "@/lib/schema";

export const maxDuration = 300;

const Body = z.object({
  name: z.string().min(1),
  party: z.string().nullish(),
  office: z.string().min(1),
  district: z.string().nullish(),
  isJudicial: z.boolean().default(false),
  otherCandidates: z.array(z.string()).default([]),
  /** What to research; omitted means everything. */
  topics: z.array(z.enum(TOPICS)).min(1).optional(),
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
  const { notes, topics: requested, ...input } = body.data;
  const topics = normalizeTopics(requested ?? TOPICS);
  const full = isFullTopics(topics);
  try {
    if (mockEnabled()) {
      if (!notes) return Response.json({ notes: "mock notes" });
      return Response.json({ research: await mockCandidate(input.name, input.party, input.isJudicial, full ? [] : topics) });
    }
    // Step 1 checks the shared cache first; a hit skips both steps. A full
    // profile also satisfies a narrower request.
    const identity = {
      name: input.name,
      office: input.office,
      district: input.district,
      state: input.election.state,
      county: input.election.county,
      electionDate: input.election.electionDate,
    };
    const fullPath = cachePath("candidate", identity);
    // "v2" retired narrow entries cached before failed lookups were detected.
    const path = full ? fullPath : cachePath("candidate", { ...identity, topics: topics.join(","), v: "2" });
    if (!notes) {
      const cached = (await readCache(path)) ?? (full ? null : await readCache(fullPath));
      if (cached) return Response.json({ research: cached, cached: true });
    }
    const task = candidateTask(input, topics);
    if (!notes) return Response.json({ notes: await gatherNotes(RESEARCH_SYSTEM, task, researchBudget(topics)) });
    const research = await analyzeNotes(CandidateResearchSchema, {
      task,
      notes,
      structureHint: candidateStructure(topics),
      tier: "candidate",
      effort: topics.length <= 2 ? "low" : "medium",
    });
    // Thin or uncertain results aren't worth reusing for 30 days.
    if (research.confidence !== "low") await writeCache(path, research);
    return Response.json({ research });
  } catch (err) {
    return errorResponse(err);
  }
}
