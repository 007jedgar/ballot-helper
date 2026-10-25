import "server-only";

/**
 * Web-search fallback for finding a sample ballot when the Civic API has no
 * data. Only the voter's city/state/ZIP is used: the street line never goes
 * into a search query or a model prompt.
 */

const ZIP = /\b(\d{5})(?:-\d{4})?\b/;
// Street, unit, or box lines ("55 Elm St", "Main Street", "Apt 2", "PO Box 4"); "St. Louis" passes.
const STREETISH =
  /^\d|\b(apt|apartment|suite|ste|unit|box|#)\b|\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|way|hwy|highway|pl|place|pkwy|parkway|cir|circle|ter|terrace)\.?$/i;

/** "123 Main St, Columbus, OH 43215" -> { area: "Columbus, OH 43215", zip: "43215" }; null if there's nothing to locate by. */
export function areaOf(address: string): { area: string; zip: string | null } | null {
  const text = address.trim().replace(/\s+/g, " ");
  const zip = text.match(ZIP)?.[1] ?? null;
  // US addresses end "City, ST ZIP": keep at most those two parts, minus anything street-like.
  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(-2)
    .filter((p) => !STREETISH.test(p));
  if (parts.length === 2) return { area: parts.join(", "), zip };
  return zip ? { area: zip, zip } : null;
}

export const BALLOT_SEARCH_SYSTEM = `You are a nonpartisan research assistant finding the sample ballot a voter will see. You research with web search and fetch, then write factual notes.

Rules:
- Prefer official sources: the county or city elections office's sample ballot page or PDF, the state's voter portal, and the secretary of state's certified candidate list. Ballotpedia's election pages and Vote411/League of Women Voters guides are good secondary sources. Local news is a last resort.
- Only list contests and candidates the sources show for this area's upcoming election. Never guess or fill in from past elections.
- Cite the URL next to each contest in your notes.
- Be concise. Notes, not prose.`;

export function ballotSearchTask(area: string, today: string) {
  return `Find the sample ballot for voters in ${area} for the next election on or after ${today}.

1. Work out the county (or parish/borough) and city for this area, and which election comes next there.
2. Find the official sample ballot for that election (the county elections office often has a lookup or PDFs by precinct or ballot style). If you can't, use Ballotpedia's pages for that county and city's elections.
3. List every contest a voter here could see, in ballot order: federal, state, judicial, county, city, school board, special districts, and ballot measures.
   - For each candidate race: the office, district/seat, how many to vote for, and every candidate with party as listed.
   - For each measure: its number/letter and title, and the ballot question text.
   - Judicial retention questions: the judge's name and court.
4. This area may span several districts (for example, two state house districts in one ZIP code). Include each district's race separately with its district number. Don't drop races because you're unsure which district applies.

Write notes with the election name and date, the county, the state, and the contests, citing a URL for each.`;
}

export const BALLOT_SEARCH_STRUCTURE = `Convert the notes into the ballot schema, in ballot order. Use only contests and candidates present in the notes. Write names in normal capitalization. For races split by district, keep one contest per district and put the district in "district". For each contest, set sourceUrl to the URL the notes cite for it. In sources, list the main pages the ballot came from (at most 5), official election offices first, each with a short label naming the publisher. Only use URLs that appear in the notes. If the notes found no ballot for the upcoming election, return an empty contests array.`;
