import "server-only";
import type { BallotExtract, CandidateResearch, MeasureResearch } from "./schema";

/** Fixture data for MOCK_AI=1, so the UI can be developed without an API key. */
export const mockEnabled = () => process.env.MOCK_AI === "1";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockBallot(): Promise<BallotExtract> {
  await delay(800);
  return {
    electionName: "General Election",
    electionDate: "2026-11-03",
    state: "Ohio",
    county: "Franklin",
    jurisdiction: "Columbus Ward 12",
    contests: [
      {
        kind: "candidate", title: "Governor", district: null, voteFor: 1, isJudicial: false, category: "state",
        candidates: [{ name: "Alex Rivera", party: "Democratic" }, { name: "Jordan Blake", party: "Republican" }, { name: "Sam Ortiz", party: "Libertarian" }],
        measureText: null, options: [],
      },
      {
        kind: "candidate", title: "Judge of the Court of Common Pleas", district: "General Division", voteFor: 1, isJudicial: true, category: "judicial",
        candidates: [{ name: "Patricia Huang", party: null }, { name: "Mark Delaney", party: null }],
        measureText: null, options: [],
      },
      {
        kind: "candidate", title: "City Council", district: "At large", voteFor: 2, isJudicial: false, category: "local",
        candidates: [{ name: "Dana Fox", party: null }, { name: "Lee Park", party: null }, { name: "Chris Moore", party: null }],
        measureText: null, options: [],
      },
      {
        kind: "candidate", title: "County Treasurer", district: null, voteFor: 1, isJudicial: false, category: "county",
        candidates: [{ name: "Pat Lee", party: "Republican" }], measureText: null, options: [],
      },
      {
        kind: "retention", title: "Supreme Court Retention", district: null, voteFor: 1, isJudicial: true, category: "judicial",
        candidates: [{ name: "Robert Klein", party: null }], measureText: "Shall Justice Robert Klein be retained in office?", options: ["Yes", "No"],
      },
      {
        kind: "measure", title: "Issue 1: Transit Levy", district: "Franklin County", voteFor: 1, isJudicial: false, category: "measure", candidates: [],
        measureText: "A 0.5% sales tax for 25 years to expand bus rapid transit and sidewalks.", options: ["For the tax levy", "Against the tax levy"],
      },
    ],
  };
}

export async function mockCandidate(
  name: string,
  party: string | null | undefined,
  isJudicial: boolean,
  topics: readonly string[] = [],
): Promise<CandidateResearch> {
  const r = await mockCandidateFull(name, party, isJudicial);
  if (!topics.length) return r;
  const keep = (t: string, v: string[]) => (topics.includes(t) ? v : []);
  return {
    ...r,
    qualifications: keep("qualifications", r.qualifications),
    keyPositions: keep("positions", r.keyPositions),
    endorsements: keep("endorsements", r.endorsements),
    accomplishments: keep("record", r.accomplishments),
    criticisms: keep("criticisms", r.criticisms),
    redFlags: topics.includes("redFlags") ? r.redFlags : [],
    news: topics.includes("news") ? r.news : [],
  };
}

async function mockCandidateFull(name: string, party: string | null | undefined, isJudicial: boolean): Promise<CandidateResearch> {
  await delay(Number(process.env.MOCK_DELAY ?? 1500) + Math.random() * 3000);
  const seed = name.length;
  const incumbent = seed % 2 === 0;
  return {
    name,
    party: party ?? null,
    oneLiner: `${name} is a ${incumbent ? "two-term incumbent" : "first-time candidate"} focused on budgets and public safety.`,
    isIncumbent: incumbent,
    age: seed % 3 === 0 ? 64 : 47,
    hasJD: isJudicial ? seed % 4 !== 1 : null,
    qualifications: isJudicial
      ? ["JD, Ohio State Moritz College of Law (2001)", "Admitted to Ohio bar 2001", "14 years as assistant prosecutor", "Rated 'Highly Recommended' by county bar"]
      : ["MPA, Ohio State University", "8 years on city council", "Former small-business owner"],
    keyPositions: ["Freeze property tax rates through 2028", "Hire 200 additional EMS staff", "Expand broadband to rural townships", "Opposes new statewide sales tax"],
    endorsements: ["Ohio AFL-CIO", "Columbus Dispatch editorial board", "Fraternal Order of Police Lodge 9", "Sierra Club Ohio"],
    accomplishments: incumbent ? ["Sponsored 2023 housing trust fund ($50M)", "Led audit that recovered $3.2M in overpayments"] : [],
    criticisms: ["Missed 18% of votes in 2025 session", "Accepted donations from contractors later awarded city work (Dispatch, 2025)"],
    redFlags:
      seed % 3 === 0
        ? [
            {
              kind: "conflict_of_interest",
              title: "Owns stake in regional oil & gas producer",
              explanation: "Holds a 30% stake in Buckeye Energy LLC, which the office would regulate through permitting decisions.",
              sourceUrl: "https://example.com/disclosure",
            },
          ]
        : seed % 5 === 0
          ? [
              {
                kind: "conviction",
                title: "Convicted of misuse of public funds (2014)",
                explanation: "Pleaded guilty while serving as county treasurer to diverting $40K to a personal account.",
                sourceUrl: null,
              },
            ]
          : [],
    news: [{ title: `${name} unveils budget plan`, source: "Columbus Dispatch", date: "2026-10-02", url: "https://example.com/news" }],
    website: "https://example.com",
    ballotpedia: `https://ballotpedia.org/${encodeURIComponent(name.replace(/ /g, "_"))}`,
    socials: [{ label: "X", url: "https://x.com/example" }],
    sources: [{ label: "Ballotpedia", url: "https://ballotpedia.org" }],
    confidence: "medium",
  };
}

export async function mockMeasure(title: string): Promise<MeasureResearch> {
  await delay(2500);
  return {
    title,
    plainSummary: "A yes vote adds a 0.5% county sales tax for 25 years to fund bus rapid transit corridors, more frequent service, and sidewalks.",
    currentLaw: "COTA is funded by an existing 0.5% sales tax; there is no dedicated funding for rapid transit corridors.",
    ifPasses: ["Sales tax rises from 7.5% to 8.0%", "~$7B over 25 years for 5 BRT corridors", "Unlocks federal matching grants"],
    ifFails: ["Tax rate unchanged", "Corridor plans shelved; federal grant applications withdrawn", "Service levels stay at 2024 baseline"],
    fiscalImpact: "County auditor estimates $280M per year in new revenue.",
    supporters: ["COTA", "Columbus Partnership", "Mayor's office"],
    opponents: ["Ohio Taxpayers Association", "Some suburban township trustees"],
    argumentsFor: ["Region is growing fastest in the Midwest and needs transit capacity", "Federal match leverages local dollars"],
    argumentsAgainst: ["Sales tax is regressive", "25 years is a long commitment with limited oversight"],
    criticalAnalysis:
      "The levy trades a regressive funding source for broad mobility gains that disproportionately benefit lower-income riders, which partly offsets the regressivity. The biggest uncertainty is construction cost inflation: if costs run over, fewer corridors may be built than promised, and the ballot language does not commit to specific routes.",
    sources: [{ label: "Franklin County Auditor", url: "https://example.com" }],
    confidence: "high",
  };
}
