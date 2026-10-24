import { z } from "zod";

// ---------- Ballot (extracted from the uploaded file) ----------

export const BallotCandidateSchema = z.object({
  name: z.string().describe("Full name exactly as printed on the ballot"),
  party: z.string().nullable().describe("Party or affiliation as printed, or null"),
});

export const ContestSchema = z.object({
  kind: z
    .enum(["candidate", "measure", "retention"])
    .describe(
      "candidate = choose among people; measure = proposition/amendment/bond/question; retention = yes/no on keeping a judge or official",
    ),
  title: z.string().describe("Office name or measure title/number as printed"),
  district: z.string().nullable().describe("District, seat, division, or jurisdiction qualifier, or null"),
  voteFor: z.number().describe("How many selections are allowed (1 for most offices and all measures)"),
  isJudicial: z.boolean().describe("True if the office is a judgeship or the retention is for a judge"),
  candidates: z
    .array(BallotCandidateSchema)
    .describe("Candidates for candidate contests; the single person for retention contests; empty for measures"),
  measureText: z
    .string()
    .nullable()
    .describe("For measures: the ballot question/summary text as printed (verbatim if short). Null otherwise"),
  options: z
    .array(z.string())
    .describe('Choices as printed. For measures/retention usually ["Yes","No"] or ["For","Against"]; empty for candidate contests'),
});

export const BallotSchema = z.object({
  electionName: z.string().nullable(),
  electionDate: z.string().nullable().describe("ISO date if visible, else null"),
  state: z.string().nullable().describe("US state name if determinable"),
  county: z.string().nullable(),
  jurisdiction: z.string().nullable().describe("City/county/precinct text that locates this ballot"),
  contests: z.array(ContestSchema),
});

export type BallotExtract = z.infer<typeof BallotSchema>;
export type ContestExtract = z.infer<typeof ContestSchema>;

// ---------- Candidate research ----------

const LinkSchema = z.object({ label: z.string(), url: z.string() });

export const CandidateResearchSchema = z.object({
  name: z.string(),
  party: z.string().nullable(),
  oneLiner: z.string().describe("One neutral sentence: who they are and what they do now"),
  isIncumbent: z.boolean(),
  age: z.number().nullable().describe("Current age in years if reliably known, else null"),
  hasJD: z
    .boolean()
    .nullable()
    .describe("For judicial races: whether they hold a law degree (JD/LLB). Null if not judicial or unknown"),
  qualifications: z
    .array(z.string())
    .describe("What qualifies them for THIS office: education, licenses/bar admission, relevant jobs, years of experience, prior offices"),
  keyPositions: z.array(z.string()).describe("Their stated priorities and policy positions, concise"),
  endorsements: z.array(z.string()).describe("Notable endorsements (organizations, unions, papers, officials)"),
  accomplishments: z
    .array(z.string())
    .describe("Incumbents only: concrete things done in office (bills, votes, rulings, programs). Empty if not incumbent"),
  criticisms: z
    .array(z.string())
    .describe("Substantive criticisms, controversies, or weaknesses raised by opponents, press, or watchdogs"),
  redFlags: z
    .array(
      z.object({
        kind: z
          .enum(["conflict_of_interest", "conviction", "impeachment", "ethics_violation"])
          .describe(
            "conflict_of_interest = personal/financial/organizational ties that clash with the duties of THIS office; conviction = criminal conviction for a serious offense; impeachment = impeached or removed from office; ethics_violation = formal finding by an ethics body, court, or bar while holding power",
          ),
        title: z.string().describe("Short label, e.g. 'Owns oil drilling company' or 'Convicted of bribery (2019)'"),
        explanation: z
          .string()
          .describe("1-2 sentences: the documented facts and why they conflict with or bear on this specific office"),
        sourceUrl: z.string().nullable(),
      }),
    )
    .describe("Only documented, verifiable red flags with a source. Empty if none. Never include rumors or mere accusations."),
  news: z
    .array(z.object({ title: z.string(), source: z.string(), date: z.string().nullable(), url: z.string() }))
    .describe("Up to 5 recent relevant articles"),
  website: z.string().nullable(),
  ballotpedia: z.string().nullable(),
  socials: z.array(LinkSchema).describe("Official campaign/office social media profiles"),
  sources: z.array(LinkSchema).describe("Pages you actually used"),
  confidence: z.enum(["high", "medium", "low"]).describe("How confident you are this info is about the right person and current"),
});

export type CandidateResearch = z.infer<typeof CandidateResearchSchema>;

// ---------- Measure research ----------

export const MeasureResearchSchema = z.object({
  title: z.string(),
  plainSummary: z.string().describe("2-4 sentences in plain English: what a YES vote does"),
  currentLaw: z.string().describe("What the law/situation is today"),
  ifPasses: z.array(z.string()).describe("Concrete effects if it passes (legal, fiscal, practical)"),
  ifFails: z.array(z.string()).describe("Concrete effects if it fails, including what stays the same"),
  fiscalImpact: z.string().nullable().describe("Official fiscal estimate or best available cost/revenue figures"),
  supporters: z.array(z.string()),
  opponents: z.array(z.string()),
  argumentsFor: z.array(z.string()),
  argumentsAgainst: z.array(z.string()),
  criticalAnalysis: z
    .string()
    .describe("Balanced critical analysis: tradeoffs, second-order effects, ambiguities in the wording, who wins/loses, what's uncertain"),
  sources: z.array(LinkSchema),
  confidence: z.enum(["high", "medium", "low"]),
});

export type MeasureResearch = z.infer<typeof MeasureResearchSchema>;
