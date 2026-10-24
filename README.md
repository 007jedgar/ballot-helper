# Ballot Helper

Upload your sample ballot and get nonpartisan research on every race and measure on it. Then compare your options in a step-by-step wizard and export a marked-up sample ballot.

- **Upload** a PDF, screenshot, or photo. AI reads every contest (multi-page PDFs are split and read page by page).
- **Choose what to research.** Before research starts, you pick what you care about, and the app researches only that:
  - **Straight ticket:** in partisan races, only your party's candidates are checked (qualifications and red flags), and they can be pre-selected.
  - **Topics:** qualifications, positions, endorsements, record, criticisms, red flags, news, or presets like "Red flags only". Fewer topics means fewer web searches per candidate and lighter analysis.
  - **Ballot sections:** federal, state, judicial, county, local, measures.
  - **Skip uncontested races.**

  The page shows how many candidates will be researched and roughly how long it will take. Anything skipped can be researched later with one click.
- **Research.** For each candidate, the app searches Ballotpedia, their campaign site and socials, endorsements, and news coverage. Each card lists qualifications for the office (for judges: law degree, bar admission, and experience), positions, endorsements, criticisms, and, for incumbents, their record in office. Age is shown only when it's over 60, and appearance is never described.
- **Measures** get a plain-English summary, what happens if they pass or fail, fiscal impact, arguments on both sides, and a critical analysis.
- **Red flags** (toggleable): a red flag next to a candidate's name marks a documented conflict of interest with the office they're running for (e.g. an oil company owner running to regulate oil, a private religious school board member running for public school board), a serious criminal conviction, an impeachment, or a formal ethics finding. An explanation and a source come with each one.
- **Compare** races side by side and pick. The checkbox at the top of each card selects and moves to the next race once it's filled. Use ← / → to move between contests. Research runs in the background, starting with the race you're viewing, and can be paused.
- **Export** a PDF of your sample ballot with your choices checked, or print it. A **Straight ticket** control there selects one party's candidates in every partisan race and leaves nonpartisan races and measures alone.
- **Share** a link to a ballot's finished research, optionally with your picks. Whoever opens it can compare right away without re-researching. Your uploaded file is never shared. Links are stored in the same private Blob store as the cache.
- **Fill in your original ballot.** If you uploaded a text-based PDF (like most county sample ballots), the app fills in the boxes next to your picks on the original document. It finds each name in the PDF's text layer and the box beside it on the rendered page. Anything it can't locate is listed so you can mark it by hand. Scans and photos don't have a text layer, so only the generated PDF is available for those.

Your ballot and picks stay in your browser (localStorage, plus IndexedDB for the uploaded file). Finished research on candidates and measures (public information) is also cached on the server for 30 days in a private Vercel Blob store. Anyone researching the same race in that time gets instant results and doesn't spend API credits. Without a Blob store connected (`BLOB_READ_WRITE_TOKEN` unset), the cache is skipped.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind v4 · Zustand · pdf-lib · Anthropic SDK (Claude with server-side web search/fetch) or Groq (`groq/compound`).

## Run locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY or GROQ_API_KEY
npm run dev
```

To work on the UI without an API key, run with fixture data: `MOCK_AI=1 npm run dev`.

## Deploy (Vercel, free Hobby plan)

1. Import this repo at vercel.com/new. No configuration is needed.
2. Add `ANTHROPIC_API_KEY` (or `GROQ_API_KEY`) under Settings → Environment Variables.
3. Optional, recommended: create a **private** Blob store under Storage and connect it to the project to turn on the 30-day research cache.
4. Deploy.

The API routes set `maxDuration = 300`, which fits within Hobby limits with Fluid Compute (on by default). Each research job takes two requests (gather notes, then analyze), so each step gets the full time limit.

## Models

| Job | Default model | Why |
| --- | --- | --- |
| Read the ballot file into contests | `claude-haiku-5-5` | Transcription: quick and high-volume |
| Web research (search, fetch, take notes) | `claude-haiku-5-5` | Fact gathering, one call per candidate |
| Candidate cards and red-flag calls | `claude-sonnet-5-5` | Summarizing and judging well-sourced notes |
| Ballot measure analysis | `claude-opus-5-5` | The most open-ended analysis in the app |

You can override each one with `ANTHROPIC_MODEL_EXTRACT`, `ANTHROPIC_MODEL_RESEARCH`, `ANTHROPIC_MODEL_ANALYZE` and `ANTHROPIC_MODEL_ANALYZE_MEASURE`. Sonnet and Opus requests opt into server-side refusal fallback (`fallbacks: "default"`); Haiku has no server-side fallback.

## Costs and support

Most of the cost is the web-research step: search results and fetched pages are re-sent on every turn. Fetched pages are capped at 6K tokens each to keep that down. Thin, low-confidence results are cached for 7 days instead of 30.

Every Claude call's approximate cost is computed from its token usage (list prices, plus $10 per 1,000 web searches). It's logged as `[cost] …` in the Vercel function logs, and saved with the cached research so the app knows what each ballot's research cost originally.

After a voter exports their ballot, a small, dismissable card says what the AI research behind it cost and offers to "chip in". It shows once per ballot, never blocks anything, and stays hidden unless a link is configured. A "Support this project" link also appears in the footer. To turn it on, create a Stripe Payment Link with **"Let customers choose what to pay"** (suggested amount $5) and set `NEXT_PUBLIC_SUPPORT_URL`. Optionally, set `NEXT_PUBLIC_SUPPORT_URL_3/_5/_10/_20` to fixed-amount links for one-tap $3/$5/$10/$20 buttons. These are build-time variables, so redeploy after setting them. The copy calls it support, not a donation, since contributions aren't tax-deductible.

## Layout

```
src/app/page.tsx                 upload
src/app/research/page.tsx        research progress
src/app/compare/page.tsx         comparison wizard
src/app/review/page.tsx          sample ballot + PDF export
src/app/api/parse-ballot         ballot file -> structured contests
src/app/api/research/*           candidate / measure research
src/lib/ai.ts                    Claude + Groq provider layer
src/lib/prompts.ts               all prompts
src/lib/schema.ts                zod schemas shared by API and UI
src/lib/research.ts              client-side research queue
src/lib/store.ts                 persisted app state
```

> AI-generated summaries can be wrong. Check the linked sources before you vote.
