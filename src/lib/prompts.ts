import "server-only";
import { TOPICS, isFullTopics, type Topic } from "./prefs";

export type ElectionContext = {
  electionName?: string | null;
  electionDate?: string | null;
  state?: string | null;
  county?: string | null;
  jurisdiction?: string | null;
};

export function describeElection(ctx: ElectionContext): string {
  return (
    [ctx.electionName, ctx.electionDate, ctx.jurisdiction, ctx.county && `${ctx.county} County`, ctx.state]
      .filter(Boolean)
      .join(", ") || "an upcoming US election"
  );
}

export const BALLOT_EXTRACTION = `This is a voter's sample ballot (or one page of it, or a photo of one). Extract every contest on it in ballot order, reading each column top to bottom, left to right.

- Candidate contests: list every candidate printed (skip write-in lines). Keep party labels as printed.
- Write names in normal capitalization even if the ballot uses ALL CAPS ("KEN PAXTON" -> "Ken Paxton", keep nicknames and suffixes: Danilo "Danny" Lacayo, Jr.).
- Ballots are often bilingual. Use only the English text; ignore translations.
- Judicial retention ("Shall Judge X be retained...") is kind "retention" with the judge as the single candidate.
- Propositions, amendments, bonds, levies, charter questions and referenda are kind "measure". Put the full English question in measureText; options are the choices printed (e.g. "For"/"Against").
- voteFor: "Vote for none or one" and "Vote for one" are 1; "Vote for not more than 2" is 2.
- Section headers (e.g. "City of Houston, Charter Amendment Election") are not contests; use them as the district for the contests beneath when helpful.
- Fill electionName/date/state/county/jurisdiction from page headers if visible (jurisdiction can be the precinct).
Do not invent contests that are not on the page.`;

export const RESEARCH_SYSTEM = `You are a nonpartisan research assistant helping a voter prepare their ballot. You research with web search and fetch, then write factual notes.

Rules:
- Prioritize: Ballotpedia, the candidate's own campaign site, official government pages (legislature, court, county election office), the candidate's official social media, voter guides (League of Women Voters / Vote411, local papers), and reputable news.
- Make sure every fact is about the correct person in the correct race and jurisdiction; people share names.
- Be balanced. Give real criticisms as well as strengths, attributed to who made them.
- Never describe physical appearance. Don't speculate about personal life.
- Cite the URL next to each fact in your notes.
- Be concise. Notes, not prose.
- You are gathering facts for an analyst who will make the judgment calls. Record what sources say, including anything that could matter for conflicts of interest or misconduct; don't editorialize or decide what is a red flag.`;

export function candidateTask(
  p: {
    name: string;
    party?: string | null;
    office: string;
    district?: string | null;
    isJudicial: boolean;
    otherCandidates: string[];
    election: ElectionContext;
  },
  topics: readonly Topic[] = TOPICS,
): string {
  const want = new Set(topics);
  const items = [
    "Ballotpedia page, campaign website, official social media accounts, whether they are the incumbent, and their date of birth or age if published.",
    want.has("qualifications") &&
      `Qualifications for THIS office specifically: education, professional licenses, relevant work, years of experience, prior offices.${
        p.isJudicial
          ? " This is a JUDICIAL race: confirm whether they have a law degree (JD/LLB), bar admission year, years practicing, type of practice, prior judicial experience, and any bar association ratings or judicial evaluation results."
          : ""
      }`,
    want.has("positions") && "Key policy positions/priorities (from their own site where possible).",
    want.has("record") && "If incumbent: concrete accomplishments in office (bills, votes, rulings, programs).",
    want.has("endorsements") && "Notable endorsements.",
    want.has("criticisms") &&
      "Substantive criticisms or controversies raised by press, watchdogs, official records, or opponents. Note who made each one. Attacks from an opponent, their campaign, or groups backing them are often one-sided: say that's where they came from, and check whether independent reporting or official records back them up.",
    want.has("news") && "Up to 5 recent relevant news articles (title, outlet, date, URL).",
    want.has("redFlags") &&
      `Red flags, with sources:
   - Conflicts of interest with THIS office: businesses they own or lead, board seats, employers, major investments, or close family ties that the office would regulate, fund, contract with, or compete against (e.g. an oil company owner running for a seat that regulates oil and gas; a board member of private religious schools running for public school board).
   - Criminal convictions for serious offenses, especially while in a position of power.
   - Impeachments or removals from office.
   - Formal ethics findings or sanctions (ethics commission, judicial conduct commission, state bar discipline).
   Only include what reliable sources document. Note pending charges as pending; don't treat mere accusations as findings.`,
  ].filter((x): x is string => Boolean(x));

  return `Research this candidate for ${describeElection(p.election)}:

Name: ${p.name}
Party: ${p.party ?? "unknown / nonpartisan"}
Running for: ${p.office}${p.district ? ` (${p.district})` : ""}
Other candidates in this race: ${p.otherCandidates.join(", ") || "none"}

Find and note:
${items.map((x, i) => `${i + 1}. ${x}`).join("\n")}${
    isFullTopics(topics) ? "" : "\n\nThe voter only wants the items above. Don't spend searches on anything else."
  }`;
}

/**
 * Fewer topics need fewer web lookups. Kept above ~5 searches: one failed
 * search shouldn't exhaust the budget (savings come mostly from topics/effort).
 */
export function researchBudget(topics: readonly Topic[]) {
  if (topics.length <= 4) return { searches: 5, fetches: 3 };
  return { searches: 6, fetches: 4 };
}

export function candidateStructure(topics: readonly Topic[] = TOPICS) {
  const base = `Convert the research notes into the candidate profile schema. Each bullet: one short, specific line (aim for under 20 words). Prefer specifics (numbers, years, names) over adjectives. If notes are thin or ambiguous about identity, set confidence to "low". redFlags: include only documented items from the notes (pending charges may be included if the title says "pending"); never infer a conflict from party affiliation or ideology alone. criticisms: give little weight to claims made only by an opponent, their campaign, or groups backing them: mark them from "opponent", phrase them as the opponent's claim, list them after independently sourced criticisms, and include at most 2. If independent reporting or official records in the notes confirm a claim, attribute it to that source instead.`;
  if (isFullTopics(topics)) return base;
  const fields: Record<Topic, string> = {
    qualifications: "qualifications",
    positions: "keyPositions",
    endorsements: "endorsements",
    record: "accomplishments",
    criticisms: "criticisms",
    redFlags: "redFlags",
    news: "news",
  };
  const skip = TOPICS.filter((t) => !topics.includes(t)).map((t) => fields[t]);
  return `${base} The voter didn't ask for these, so leave them as empty arrays: ${skip.join(", ")}.`;
}

export function measureTask(p: { title: string; district?: string | null; text?: string | null; election: ElectionContext }): string {
  return `Research this ballot measure for ${describeElection(p.election)}:

Title: ${p.title}${p.district ? `\nJurisdiction: ${p.district}` : ""}
Ballot text: ${p.text ?? "(not provided)"}

Find and note:
1. What it does in plain English and what current law is.
2. Official fiscal impact estimate (legislative analyst, fiscal note, county auditor), if any.
3. Concrete effects if it PASSES and if it FAILS, including legal, fiscal, and practical consequences.
4. Who supports and opposes it (organizations, officials, funding if reported).
5. Strongest arguments on each side.
6. A critical analysis: tradeoffs, second-order effects, ambiguous wording, implementation risks, who wins and who loses.`;
}

export const MEASURE_STRUCTURE = `Convert the research notes into the measure analysis schema. Keep bullets short and concrete. The criticalAnalysis should be 1-2 balanced paragraphs and must not tell the voter how to vote.`;
