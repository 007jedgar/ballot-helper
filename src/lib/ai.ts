import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import Groq from "groq-sdk";
import { z } from "zod";
import { costOf } from "./cost";

/**
 * Provider-agnostic helpers. Claude is used when ANTHROPIC_API_KEY is set,
 * otherwise Groq when GROQ_API_KEY is set. Set AI_PROVIDER to force one.
 */

export type Provider = "claude" | "groq";

export function activeProvider(): Provider | null {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "claude" || forced === "groq") return forced;
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GROQ_API_KEY) return "groq";
  return null;
}

export class ConfigError extends Error {}

function requireProvider(): Provider {
  const p = activeProvider();
  if (!p) throw new ConfigError("No AI provider configured. Set ANTHROPIC_API_KEY or GROQ_API_KEY.");
  return p;
}

/**
 * Claude models by job. Haiku does the quick, high-volume pulling work
 * (transcribing the ballot, searching the web and taking notes). Sonnet turns
 * candidate notes into profiles and red-flag calls; Opus writes the measure
 * analysis, the most open-ended judgment in the app.
 */
const MODELS = {
  extract: process.env.ANTHROPIC_MODEL_EXTRACT || "claude-haiku-5-5",
  research: process.env.ANTHROPIC_MODEL_RESEARCH || "claude-haiku-5-5",
  analyze: process.env.ANTHROPIC_MODEL_ANALYZE || "claude-sonnet-5-5",
  analyzeMeasure: process.env.ANTHROPIC_MODEL_ANALYZE_MEASURE || "claude-opus-5-5",
};

/** A model result plus its approximate cost in USD (null when unknown, e.g. Groq). */
export type Costed<T> = { value: T; cost: number | null };
/** Measures get more analysis effort than candidate profiles. */
export type AnalysisTier = "candidate" | "measure";
const GROQ_RESEARCH_MODEL = process.env.GROQ_RESEARCH_MODEL || "groq/compound";
const GROQ_STRUCT_MODEL = process.env.GROQ_STRUCT_MODEL || "openai/gpt-oss-120b";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

// Server-side refusal fallback: if the model declines, the API reruns the
// request on a fallback model chosen by refusal category. Haiku has no
// server-side fallback, so it gets neither the beta nor the parameter.
const fallback = (model: string) =>
  /^claude-(opus-5|sonnet-5-5|fable-5-1)/.test(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

let anthropic: Anthropic | null = null;
const claude = () => (anthropic ??= new Anthropic());
let groqClient: Groq | null = null;
const groq = () => (groqClient ??= new Groq());

export type UploadedFile = { mediaType: string; base64: string };

// ---------------------------------------------------------------------------
// Structured extraction from a ballot file (PDF or image)
// ---------------------------------------------------------------------------

export async function extractFromFile<S extends z.ZodType>(
  schema: S,
  file: UploadedFile,
  instructions: string,
): Promise<Costed<z.infer<S>>> {
  const provider = requireProvider();

  if (provider === "claude") {
    const fileBlock: Anthropic.Beta.BetaContentBlockParam =
      file.mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: file.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: file.base64,
            },
          };
    const res = await claude().beta.messages.parse({
      model: MODELS.extract,
      max_tokens: 16000,
      ...fallback(MODELS.extract),
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: instructions }] }],
    });
    if (res.stop_reason === "refusal") throw new Error("The model declined to process this file.");
    if (!res.parsed_output) throw new Error("Could not read the ballot. Try a clearer scan.");
    return { value: res.parsed_output as z.infer<S>, cost: costOf(res.model, res.usage) };
  }

  if (file.mediaType === "application/pdf") {
    throw new ConfigError("Groq can't read PDFs directly. Upload a photo/screenshot of the ballot, or set ANTHROPIC_API_KEY.");
  }
  const res = await groq().chat.completions.create({
    model: GROQ_VISION_MODEL,
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${file.mediaType};base64,${file.base64}` } },
          { type: "text", text: `${instructions}\n\nRespond with JSON matching this schema:\n${JSON.stringify(jsonSchema(schema))}` },
        ],
      },
    ],
  });
  return { value: parseJson(schema, res.choices[0]?.message?.content), cost: null };
}

// ---------------------------------------------------------------------------
// Web research -> structured result (two passes: research notes, then JSON)
// ---------------------------------------------------------------------------

/**
 * Research is split into two steps, each its own HTTP request, so each gets
 * the full serverless time limit: gather notes from the web, then analyze them.
 */
export type SearchBudget = { searches: number; fetches: number };
const DEFAULT_BUDGET: SearchBudget = { searches: 6, fetches: 4 };

export async function gatherNotes(system: string, task: string, budget: SearchBudget = DEFAULT_BUDGET): Promise<Costed<string>> {
  if (requireProvider() === "claude") return claudeResearch(system, task, budget);
  return { value: await groqResearch(system, task), cost: null };
}

export async function analyzeNotes<S extends z.ZodType>(
  schema: S,
  opts: { task: string; notes: string; structureHint: string; tier: AnalysisTier; effort?: "low" | "medium" | "high" },
): Promise<Costed<z.infer<S>>> {
  const provider = requireProvider();
  const prompt = `${opts.structureHint}\n\nThe research assignment was:\n<assignment>\n${opts.task}\n</assignment>\n\nResearch notes (with source URLs):\n<notes>\n${opts.notes}\n</notes>\n\nOnly use facts present in the notes. Use empty arrays or null where the notes have nothing.`;

  if (provider === "claude") {
    const model = opts.tier === "measure" ? MODELS.analyzeMeasure : MODELS.analyze;
    const res = await claude().beta.messages.parse({
      model,
      max_tokens: 16000,
      ...fallback(model),
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort ?? (opts.tier === "measure" ? "high" : "medium"), format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: prompt }],
    });
    if (!res.parsed_output) throw new Error("Could not structure the research results.");
    return { value: res.parsed_output as z.infer<S>, cost: costOf(res.model, res.usage) };
  }

  const res = await groq().chat.completions.create({
    model: GROQ_STRUCT_MODEL,
    max_completion_tokens: 8192,
    response_format: {
      type: "json_schema",
      json_schema: { name: "result", schema: jsonSchema(schema), strict: false },
    },
    messages: [{ role: "user", content: prompt }],
  });
  return { value: parseJson(schema, res.choices[0]?.message?.content), cost: null };
}

const WRITE_UP = "Stop searching now. Write your research notes from what you have already found, with source URLs.";

/** Web search/fetch calls in this turn that actually returned content. */
const lookupsFound = (content: Anthropic.Beta.BetaContentBlock[]) =>
  content.filter(
    (b) =>
      (b.type === "web_search_tool_result" && Array.isArray(b.content) && b.content.length > 0) ||
      (b.type === "web_fetch_tool_result" && b.content.type === "web_fetch_result"),
  ).length;

export class ResearchFailedError extends Error {}

const textOf = (content: Anthropic.Beta.BetaContentBlock[]) =>
  content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

async function claudeResearch(system: string, task: string, budget: SearchBudget): Promise<Costed<string>> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: task }];
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: budget.searches },
    // Whole pages get re-sent on every turn; capping them is the biggest cost lever
    // (and keeps Haiku prompts under 100K tokens, where its price jumps).
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: budget.fetches, max_content_tokens: 6000 },
  ];
  let writeUp = false;
  let found = 0;
  let cost = 0;
  for (let turn = 0; turn < 6; turn++) {
    const res = await claude()
      .beta.messages.stream({
        model: MODELS.research,
        max_tokens: 32000,
        ...fallback(MODELS.research),
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system,
        tools,
        ...(writeUp ? { tool_choice: { type: "none" as const } } : {}),
        messages,
      })
      .finalMessage();
    if (res.stop_reason === "refusal") throw new Error("The model declined this research request.");
    found += lookupsFound(res.content);
    cost += costOf(res.model, res.usage);
    const text = textOf(res.content);

    // A long server-tool turn can pause; it must be resumed by sending it back as-is.
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    // Notes written without a single successful lookup are guesses from memory
    // (e.g. web search errored out). Fail so nothing is cached and the client retries.
    if ((text.length > 200 || (writeUp && text)) && found === 0) {
      throw new ResearchFailedError("Web search didn't return results for this candidate. Try again.");
    }
    // Long enough to be real notes: done (even if cut off by max_tokens).
    if (text.length > 200 || (writeUp && text)) return { value: text, cost };
    if (writeUp) break;

    // Ended without writing notes (e.g. after its last search): ask for them.
    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: WRITE_UP });
    writeUp = true;
  }
  throw new Error("Research returned no content.");
}

async function groqResearch(system: string, task: string): Promise<string> {
  const res = await groq().chat.completions.create({
    model: GROQ_RESEARCH_MODEL,
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: system },
      { role: "user", content: task },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Research returned no content.");
  return text;
}

// ---------------------------------------------------------------------------

function jsonSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, { target: "draft-7" });
}

function parseJson<S extends z.ZodType>(schema: S, raw: string | null | undefined): z.infer<S> {
  if (!raw) throw new Error("Empty response from model.");
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = schema.safeParse(JSON.parse(match ? match[0] : raw));
  if (!parsed.success) throw new Error("Model returned data in an unexpected shape.");
  return parsed.data;
}
