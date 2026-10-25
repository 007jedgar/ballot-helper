import type { ContestExtract } from "./schema";

/**
 * What the voter wants researched. Narrower preferences mean fewer research
 * jobs and smaller ones (fewer web searches, shorter analysis), which saves
 * time and API tokens.
 */

export const TOPICS = ["qualifications", "positions", "endorsements", "record", "criticisms", "redFlags", "news"] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  qualifications: "Qualifications",
  positions: "Positions",
  endorsements: "Endorsements",
  record: "Record in office",
  criticisms: "Criticisms",
  redFlags: "Red flags",
  news: "Recent news",
};

export const PRESETS: { id: string; label: string; topics: Topic[] }[] = [
  { id: "full", label: "Everything", topics: [...TOPICS] },
  { id: "essentials", label: "Essentials", topics: ["qualifications", "positions", "record", "redFlags"] },
  { id: "flags", label: "Red flags only", topics: ["redFlags"] },
];

export const CATEGORIES = ["federal", "state", "judicial", "county", "local", "measure"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  federal: "Federal",
  state: "State",
  judicial: "Judicial",
  county: "County",
  local: "City, school & districts",
  measure: "Measures & propositions",
};

export const PARTIES = ["democratic", "republican", "libertarian", "green", "independent"] as const;
export type Party = (typeof PARTIES)[number];

export const PARTY_LABELS: Record<Party, string> = {
  democratic: "Democratic",
  republican: "Republican",
  libertarian: "Libertarian",
  green: "Green",
  independent: "Independent",
};

export type Prefs = {
  /** Straight-ticket party, or null to research everyone. */
  party: Party | null;
  topics: Topic[];
  categories: Category[];
  skipUncontested: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  party: null,
  topics: [...TOPICS],
  categories: [...CATEGORIES],
  skipUncontested: true,
};

/** Red flags are checked for the voter's own party even when they only want a quick check. */
export const STRAIGHT_TICKET_TOPICS: Topic[] = ["qualifications", "redFlags"];

export const isFullTopics = (topics: readonly Topic[]) => TOPICS.every((t) => topics.includes(t));

/** Canonical, order-independent form for cache keys and request bodies. */
export const normalizeTopics = (topics: readonly Topic[]): Topic[] => TOPICS.filter((t) => topics.includes(t));

type ContestLike = Pick<ContestExtract, "kind" | "title" | "district" | "isJudicial"> & { category?: Category | null };

export function categoryOf(c: ContestLike): Category {
  if (c.kind === "measure") return "measure";
  if (c.isJudicial || c.kind === "retention") return "judicial";
  if (c.category && c.category !== "measure") return c.category;
  const t = `${c.title} ${c.district ?? ""}`.toLowerCase();
  if (/united states|u\.s\.|congress|president/.test(t)) return "federal";
  if (/city|mayor|council|school|trustee|\bisd\b|college|appraisal|hcad|utility|\bmud\b|hospital|port |navigation|water|library|park/.test(t))
    return "local";
  if (/county|sheriff|constable|district attorney|district clerk|tax assessor|treasurer|clerk|precinct/.test(t)) return "county";
  if (/state|governor|lieutenant|attorney general|comptroller|commissioner|railroad|secretary of state|legislat|assembly/.test(t))
    return "state";
  return "county";
}

export function partyOf(label: string | null | undefined): Party | null {
  const l = (label ?? "").toLowerCase().trim();
  // Ballots and data feeds often abbreviate: "R", "(D)", "Lib", "Grn", "IND".
  const abbr = l.replace(/[().]/g, "");
  if (/^(d|dem)$/.test(abbr)) return "democratic";
  if (/^(r|rep)$/.test(abbr)) return "republican";
  if (/^(l|lib|lbt)$/.test(abbr)) return "libertarian";
  if (/^(g|grn)$/.test(abbr)) return "green";
  if (/^(i|ind|npa)$/.test(abbr)) return "independent";
  if (/democrat/.test(l)) return "democratic";
  if (/republican|\bgop\b/.test(l)) return "republican";
  if (/libertarian/.test(l)) return "libertarian";
  if (/green/.test(l)) return "green";
  if (/independent|no party|unaffiliated/.test(l)) return "independent";
  return null;
}

export type ContestPlan =
  | { research: false; reason: "category" | "uncontested" }
  | { research: true; candidates: number[]; topics: Topic[]; partyFiltered: boolean };

/**
 * Which candidates in a contest get researched, and how deeply. `forced`
 * contests (the voter asked for them explicitly) get full research.
 */
export function planContest(c: ContestLike & { candidates: { party: string | null }[] }, prefs: Prefs, forced = false): ContestPlan {
  const all = c.candidates.map((_, i) => i);
  if (forced) return { research: true, candidates: all, topics: [...TOPICS], partyFiltered: false };
  if (!prefs.categories.includes(categoryOf(c))) return { research: false, reason: "category" };
  if (c.kind === "measure") return { research: true, candidates: [], topics: [...TOPICS], partyFiltered: false };
  if (c.kind === "candidate" && prefs.skipUncontested && c.candidates.length <= 1) return { research: false, reason: "uncontested" };

  const topics = normalizeTopics(prefs.topics.length ? prefs.topics : ["redFlags"]);
  if (prefs.party && c.kind === "candidate") {
    const mine = all.filter((i) => partyOf(c.candidates[i].party) === prefs.party);
    // Partisan race with the voter's party on it: only check their candidate(s), for red flags.
    if (mine.length) {
      return { research: true, candidates: mine, topics: STRAIGHT_TICKET_TOPICS, partyFiltered: true };
    }
  }
  return { research: true, candidates: all, topics, partyFiltered: false };
}

/**
 * Straight-ticket picks: in each candidate race with someone from `party`,
 * those candidates (up to the race's vote-for limit). Races without that
 * party, nonpartisan races and measures are left out.
 */
export function straightTicketPicks(
  contests: { id: string; kind: ContestExtract["kind"]; voteFor: number; candidates: { name: string; party: string | null }[] }[],
  party: Party,
): Record<string, string[]> {
  const picks: Record<string, string[]> = {};
  for (const c of contests) {
    if (c.kind !== "candidate") continue;
    const mine = c.candidates.filter((x) => partyOf(x.party) === party).map((x) => x.name);
    if (mine.length) picks[c.id] = mine.slice(0, Math.max(1, c.voteFor));
  }
  return picks;
}
