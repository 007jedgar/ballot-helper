# Ballot Helper

Upload your sample ballot and get nonpartisan research on every race and measure on it. Then compare your options in a step-by-step wizard and export a marked-up sample ballot.

- **Upload** a PDF, screenshot, or photo. AI reads every contest (multi-page PDFs are split and read page by page).
- **Research.** For each candidate, the app searches Ballotpedia, their campaign site and socials, endorsements, and news coverage. Each card lists qualifications for the office (for judges: law degree, bar admission, and experience), positions, endorsements, criticisms, and, for incumbents, their record in office. Age is shown only when it's over 60, and appearance is never described.
- **Measures** get a plain-English summary, what happens if they pass or fail, fiscal impact, arguments on both sides, and a critical analysis.
- **Compare** races side by side and pick. Use ← / → to move between contests. Research runs in the background, starting with the race you're viewing, and can be paused.
- **Export** a PDF of your sample ballot with your choices checked, or print it.

Everything you do stays in your browser (localStorage). The server only forwards requests to the AI provider. It has no database.

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
3. Deploy.

The API routes set `maxDuration = 300`, which fits within Hobby limits with Fluid Compute (on by default).

## Cost notes

Each candidate takes one research call (web search and fetch) plus a small call to structure the results. Measures work the same way. A large county ballot can have 200+ candidates (Harris County, TX has about 220), so with the default `claude-opus-5-5` model a full ballot can cost tens of dollars in API usage. To reduce it:

- set `ANTHROPIC_MODEL=claude-sonnet-5-5` (or `claude-haiku-5-5`),
- use Groq instead, or
- pause research and let it run only for the races you open in the wizard (it always researches the race you're viewing first).

Claude requests opt into server-side refusal fallback (`fallbacks: "default"`), so a declined request is retried on a fallback model instead of failing.

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
