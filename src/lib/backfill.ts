import "server-only";
import { z } from "zod";
import { recordSpend } from "./abuse";
import { quickStructured } from "./ai";
import { writeCache, type CacheEntry } from "./cache";
import { CriticismSchema, type CandidateResearch } from "./schema";

/** Profiles saved before criticisms said who raised them have plain strings. */
export type SavedResearch = Omit<CandidateResearch, "criticisms"> & { criticisms: (string | CandidateResearch["criticisms"][number])[] };

const Attributed = z.object({ criticisms: z.array(CriticismSchema) });

/**
 * Attributes a saved profile's plain-text criticisms (opponent, press, ...)
 * and re-saves it with its original age. Returns the profile unchanged if
 * there's nothing to do or the model call fails.
 */
export async function attributeSavedCriticisms(
  path: string,
  entry: CacheEntry<SavedResearch>,
  race: { office: string; otherCandidates: string[] },
): Promise<SavedResearch> {
  const r = entry.data;
  const plain = r.criticisms.filter((c): c is string => typeof c === "string");
  if (!plain.length) return r;
  try {
    const result = await quickStructured(
      Attributed,
      `These criticisms of ${r.name}, a candidate for ${race.office}, were collected from the web without recording who made them. Other candidates in the race: ${race.otherCandidates.join(", ") || "none"}.

For each one, in the same order, say who raised it, judging only from its wording and the sources below. Use "opponent" when it comes from a rival candidate, their campaign, or groups backing them, and rephrase its text as their claim ("Opponent says ..."). Otherwise keep the text exactly as is. Use "other" when the source isn't clear.

Criticisms:
${plain.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Sources used for this profile:
${[...r.sources.map((s) => `${s.label}: ${s.url}`), ...r.news.map((n) => `${n.source}: ${n.title} ${n.url}`)].join("\n") || "none recorded"}`,
    );
    if (!result || result.value.criticisms.length !== plain.length) return r;
    await recordSpend(result.cost);
    let i = 0;
    const data = { ...r, criticisms: r.criticisms.map((c) => (typeof c === "string" ? result.value.criticisms[i++] : c)) };
    await writeCache(path, data, entry.cost, entry.ttlDays, entry.savedAt);
    return data;
  } catch (err) {
    console.warn("criticism backfill failed", err);
    return r;
  }
}
