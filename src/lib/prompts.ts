import "server-only";

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
- Be concise. Notes, not prose.`;

export function candidateTask(p: {
  name: string;
  party?: string | null;
  office: string;
  district?: string | null;
  isJudicial: boolean;
  otherCandidates: string[];
  election: ElectionContext;
}): string {
  return `Research this candidate for ${describeElection(p.election)}:

Name: ${p.name}
Party: ${p.party ?? "unknown / nonpartisan"}
Running for: ${p.office}${p.district ? ` (${p.district})` : ""}
Other candidates in this race: ${p.otherCandidates.join(", ") || "none"}

Find and note:
1. Ballotpedia page; campaign website; official social media accounts.
2. Whether they are the incumbent. If so: concrete accomplishments in office AND substantive criticisms/controversies.
3. Qualifications for THIS office specifically: education, professional licenses, relevant work, years of experience, prior offices.${
    p.isJudicial
      ? "\n   This is a JUDICIAL race: confirm whether they have a law degree (JD/LLB), bar admission year, years practicing, type of practice, prior judicial experience, and any bar association ratings or judicial evaluation results."
      : ""
  }
4. Key policy positions/priorities (from their own site where possible).
5. Notable endorsements.
6. Criticisms raised by opponents, press, or watchdogs.
7. Up to 5 recent relevant news articles (title, outlet, date, URL).
8. Their date of birth or age, if published.`;
}

export const CANDIDATE_STRUCTURE = `Convert the research notes into the candidate profile schema. Each bullet: one short, specific line (aim for under 20 words). Prefer specifics (numbers, years, names) over adjectives. If notes are thin or ambiguous about identity, set confidence to "low".`;

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
