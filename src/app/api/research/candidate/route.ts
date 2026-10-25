import { z } from "zod";
import { checkBudget, rateLimit, recordSpend, sameSite } from "@/lib/abuse";
import { analyzeNotes, gatherNotes } from "@/lib/ai";
import { cachePath, candidatePath, readCache, writeCache } from "@/lib/cache";
import { attributeSavedCriticisms, type SavedResearch } from "@/lib/backfill";
import { costed, errorResponse } from "@/lib/http";
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
  /** Step 2: what step 1 cost, so the cached entry records the full cost. */
  gatherCost: z.number().min(0).max(100).nullish(),
});

export async function POST(req: Request) {
  const crossSite = sameSite(req);
  if (crossSite) return crossSite;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { notes, gatherCost, topics: requested, ...input } = body.data;
  const topics = normalizeTopics(requested ?? TOPICS);
  const full = isFullTopics(topics);
  try {
    if (mockEnabled()) {
      const limited = (await rateLimit(req, "research")) ?? (notes ? null : await checkBudget());
      if (limited) return limited;
      await recordSpend(notes ? 0.05 : 0.03);
      if (!notes) return Response.json({ notes: "mock notes", cost: 0.03 });
      const research = await mockCandidate(input.name, input.party, input.isJudicial, full ? [] : topics);
      return Response.json({ research, cost: 0.05 + (gatherCost ?? 0) });
    }
    // Step 1 checks the shared cache first; a hit skips both steps. A full
    // profile also satisfies a narrower request.
    const topicKey = { topics: topics.join(","), v: "2" };
    const fullPath = candidatePath(input.name, input.election);
    const path = full ? fullPath : candidatePath(input.name, input.election, topicKey);
    if (!notes) {
      // Entries written before v2 keys (which included the transcribed office) are still read.
      const legacy = {
        name: input.name,
        office: input.office,
        district: input.district,
        state: input.election.state,
        county: input.election.county,
        electionDate: input.election.electionDate,
      };
      const lookups = full ? [fullPath, cachePath("candidate", legacy)] : [path, fullPath, cachePath("candidate", { ...legacy, ...topicKey })];
      for (const p of lookups) {
        const cached = await readCache<SavedResearch>(p);
        if (cached) {
          const research = await attributeSavedCriticisms(p, cached, input);
          return Response.json({ research, cached: true, cost: cached.cost });
        }
      }
    }
    // New (uncached) work: count it against limits; only gathering is stopped by the daily budget,
    // so a candidate whose notes were already gathered can still finish.
    const blocked = (await rateLimit(req, "research")) ?? (notes ? null : await checkBudget());
    if (blocked) return blocked;
    const task = candidateTask(input, topics);
    if (!notes) return Response.json(await costed("gather", await gatherNotes(RESEARCH_SYSTEM, task, researchBudget(topics)), "notes"));
    const analyzed = await analyzeNotes(CandidateResearchSchema, {
      task,
      notes,
      structureHint: candidateStructure(topics),
      tier: "candidate",
      effort: topics.length <= 2 ? "low" : "medium",
    });
    await recordSpend(analyzed.cost);
    const research = analyzed.value;
    const cost = analyzed.cost == null ? null : analyzed.cost + (gatherCost ?? 0);
    // Thin results (often obscure candidates) are still worth reusing, just not for as long.
    await writeCache(path, research, cost, research.confidence === "low" ? 7 : undefined);
    return Response.json({ research, cost });
  } catch (err) {
    return errorResponse(err);
  }
}
