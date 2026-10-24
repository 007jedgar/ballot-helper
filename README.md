# Ballot Helper

Upload your sample ballot and get nonpartisan research on every race and measure on it. Then compare your options in a step-by-step wizard and export a marked-up sample ballot.

- **Upload** a PDF, screenshot, or photo. AI reads every contest (multi-page PDFs are split and read page by page).
- **Research.** For each candidate, the app searches Ballotpedia, their campaign site and socials, endorsements, and news coverage. Each card lists qualifications for the office (for judges: law degree, bar admission, and experience), positions, endorsements, criticisms, and, for incumbents, their record in office. Age is shown only when it's over 60, and appearance is never described.
- **Measures** get a plain-English summary, what happens if they pass or fail, fiscal impact, arguments on both sides, and a critical analysis.
- **Red flags** (toggleable): a red flag next to a candidate's name marks a documented conflict of interest with the office they're running for (e.g. an oil company owner running to regulate oil, a private religious school board member running for public school board), a serious criminal conviction, an impeachment, or a formal ethics finding. An explanation and a source come with each one.
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

## Models

| Job | Default model | Why |
| --- | --- | --- |
| Read the ballot file into contests | `claude-haiku-5-5` | Transcription: quick and high-volume |
| Web research (search, fetch, take notes) | `claude-haiku-5-5` | Fact gathering, one call per candidate |
| Candidate cards, red flags, measure analysis | `claude-opus-5-5` | Judgment and explanation |

You can override each one with `ANTHROPIC_MODEL_EXTRACT`, `ANTHROPIC_MODEL_RESEARCH` and `ANTHROPIC_MODEL_ANALYZE`. Opus requests opt into server-side refusal fallback (`fallbacks: "default"`), so a declined request is retried on a fallback model. Haiku has no server-side fallback.

A large county ballot can have 200+ candidates (Harris County, TX has about 220). Research runs in the background, starting with the race you're viewing, and can be paused.

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
