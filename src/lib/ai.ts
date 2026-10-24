import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import Groq from "groq-sdk";
import { z } from "zod";

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

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const GROQ_RESEARCH_MODEL = process.env.GROQ_RESEARCH_MODEL || "groq/compound";
const GROQ_STRUCT_MODEL = process.env.GROQ_STRUCT_MODEL || "openai/gpt-oss-120b";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

// Server-side refusal fallback: if the model declines, the API reruns the
// request on a fallback model chosen by refusal category.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

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
): Promise<z.infer<S>> {
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
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: instructions }] }],
    });
    if (res.stop_reason === "refusal") throw new Error("The model declined to process this file.");
    if (!res.parsed_output) throw new Error("Could not read the ballot. Try a clearer scan.");
    return res.parsed_output as z.infer<S>;
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
  return parseJson(schema, res.choices[0]?.message?.content);
}

// ---------------------------------------------------------------------------
// Web research -> structured result (two passes: research notes, then JSON)
// ---------------------------------------------------------------------------

export async function researchStructured<S extends z.ZodType>(
  schema: S,
  opts: { system: string; task: string; structureHint: string },
): Promise<z.infer<S>> {
  const provider = requireProvider();
  const notes = provider === "claude" ? await claudeResearch(opts.system, opts.task) : await groqResearch(opts.system, opts.task);
  const prompt = `${opts.structureHint}\n\nResearch notes (with source URLs):\n<notes>\n${notes}\n</notes>\n\nOnly use facts present in the notes. Use empty arrays or null where the notes have nothing.`;

  if (provider === "claude") {
    const res = await claude().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: prompt }],
    });
    if (!res.parsed_output) throw new Error("Could not structure the research results.");
    return res.parsed_output as z.infer<S>;
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
  return parseJson(schema, res.choices[0]?.message?.content);
}

async function claudeResearch(system: string, task: string): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: task }];
  // A long server-tool turn can pause; resume it by sending the partial turn back.
  for (let i = 0; i < 4; i++) {
    const res = await claude().beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 8 },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
      ],
      messages,
    });
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") throw new Error("The model declined this research request.");
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Research returned no content.");
    return text;
  }
  throw new Error("Research took too long. Try again.");
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
