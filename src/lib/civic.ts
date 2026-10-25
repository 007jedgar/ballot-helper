import "server-only";
import type { BallotExtract, ContestExtract } from "./schema";

/**
 * Sample ballot lookup by address via the Google Civic Information API
 * (voterInfoQuery). Coverage depends on what states and counties publish
 * through the Voting Information Project, so many addresses come back with
 * no contests; the UI points those voters to other lookups.
 */

export class LookupError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type CivicCandidate = { name?: string; party?: string };
type CivicContest = {
  type?: string;
  office?: string;
  ballotTitle?: string;
  level?: string[];
  roles?: string[];
  district?: { name?: string; scope?: string };
  numberElected?: string | number;
  numberVotingFor?: string | number;
  ballotPlacement?: string | number;
  candidates?: CivicCandidate[];
  referendumTitle?: string;
  referendumSubtitle?: string;
  referendumText?: string;
  referendumBrief?: string;
  referendumBallotResponses?: string[];
};
type VoterInfo = {
  election?: { name?: string; electionDay?: string };
  normalizedInput?: { city?: string; state?: string };
  contests?: CivicContest[];
};

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands", AS: "American Samoa", MP: "Northern Mariana Islands",
};

const JUDICIAL = /\b(judge|justice|court|magistrate)\b/i;

function category(c: CivicContest, judicial: boolean): ContestExtract["category"] {
  if (judicial) return "judicial";
  const level = c.level ?? [];
  if (level.includes("country")) return "federal";
  if (level.includes("administrativeArea1")) return "state";
  if (level.includes("administrativeArea2")) return "county";
  if (level.length) return "local";
  switch (c.district?.scope) {
    case "congressional":
      return "federal";
    case "statewide":
    case "stateUpper":
    case "stateLower":
      return /\b(u\.?s\.?|united states|president)\b/i.test(c.office ?? "") ? "federal" : "state";
    case "countywide":
    case "countyCouncil":
      return "county";
    default:
      return /\b(u\.?s\.?|united states|president)\b/i.test(c.office ?? "") ? "federal" : "local";
  }
}

const num = (v: string | number | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function toContest(c: CivicContest): ContestExtract | null {
  const isMeasure = c.type === "Referendum" || Boolean(c.referendumTitle);
  if (isMeasure) {
    const title = [c.referendumTitle, c.referendumSubtitle].filter(Boolean).join(": ") || c.ballotTitle;
    if (!title) return null;
    return {
      kind: "measure",
      title,
      district: c.district?.name ?? null,
      voteFor: 1,
      isJudicial: false,
      category: "measure",
      candidates: [],
      measureText: c.referendumText || c.referendumBrief || c.referendumSubtitle || null,
      options: c.referendumBallotResponses?.length ? c.referendumBallotResponses : ["Yes", "No"],
    };
  }

  const title = c.office || c.ballotTitle;
  const candidates = (c.candidates ?? [])
    .filter((p): p is CivicCandidate & { name: string } => Boolean(p.name?.trim()))
    .map((p) => ({ name: p.name.trim(), party: p.party?.trim() || null }));
  if (!title || !candidates.length) return null;

  const isJudicial = Boolean(c.roles?.some((r) => r === "judge" || r === "highestCourtJudge")) || JUDICIAL.test(title);
  const retention = /retention|retain/i.test(`${c.type ?? ""} ${title}`);
  // Districts often repeat the office ("Ohio" for Governor); keep them only when they add something.
  const district = c.district?.name && !title.toLowerCase().includes(c.district.name.toLowerCase()) ? c.district.name : null;
  return {
    kind: retention ? "retention" : "candidate",
    title,
    district,
    voteFor: retention ? 1 : (num(c.numberVotingFor) ?? num(c.numberElected) ?? 1),
    isJudicial,
    category: category(c, isJudicial),
    candidates: retention ? candidates.slice(0, 1) : candidates,
    measureText: null,
    options: retention ? ["Yes", "No"] : [],
  };
}

export function voterInfoToBallot(info: VoterInfo): BallotExtract {
  const contests = (info.contests ?? [])
    .map((c, i) => ({ c, i }))
    // Ballot placement when provided, otherwise the API's own order.
    .sort((a, b) => (num(a.c.ballotPlacement) ?? 1e6 + a.i) - (num(b.c.ballotPlacement) ?? 1e6 + b.i))
    .map(({ c }) => toContest(c))
    .filter((c): c is ContestExtract => c !== null);
  const abbr = info.normalizedInput?.state?.toUpperCase();
  return {
    electionName: info.election?.name ?? null,
    electionDate: info.election?.electionDay ?? null,
    state: (abbr && STATES[abbr]) ?? abbr ?? null,
    county: null,
    jurisdiction: info.normalizedInput?.city ?? null,
    contests,
  };
}

export async function lookupBallot(address: string): Promise<BallotExtract> {
  const key = process.env.GOOGLE_CIVIC_API_KEY;
  if (!key) throw new LookupError("Address lookup isn't set up on this server. Upload your sample ballot instead.", 503);
  const url = new URL("https://www.googleapis.com/civicinfo/v2/voterinfo");
  url.searchParams.set("key", key);
  url.searchParams.set("address", address);
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // Google pairs a vague reason ("invalid") with the useful part in the message ("Election unknown").
    const reason = `${json?.error?.errors?.[0]?.reason ?? ""} ${json?.error?.message ?? ""}`.trim();
    console.error(`[lookup] civic ${res.status} ${reason}`);
    if (/parseError|parse address/i.test(reason)) throw new LookupError("We couldn't find that address. Include the street, city, state, and ZIP.");
    if (/election|notFound/i.test(reason) || res.status === 404) throw new LookupError(NO_DATA, 404);
    throw new LookupError("The ballot lookup service isn't responding. Try again, or upload your sample ballot.", 502);
  }
  const ballot = voterInfoToBallot(json as VoterInfo);
  if (!ballot.contests.length) throw new LookupError(NO_DATA, 404);
  return ballot;
}

const NO_DATA = "There's no ballot data for this address yet. Your county may not publish it to our lookup service.";
