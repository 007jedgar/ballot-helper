import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Approximate USD cost of a Claude response, from its usage block. Used to
 * show voters what the research behind their ballot cost. List prices per
 * million tokens; cache writes bill at 1.25x input, cache reads at 0.1x.
 */

const PRICES: [prefix: string, input: number, output: number][] = [
  ["claude-haiku-5-5", 0.1, 0.5],
  ["claude-sonnet-5", 2, 10],
  ["claude-opus-5-5", 4, 20],
  ["claude-opus-5", 5, 25],
  ["claude-fable-5", 10, 50],
  ["claude-haiku-4-5", 1, 5],
  ["claude-opus-4", 5, 25],
  ["claude-sonnet-4", 3, 15],
];
const WEB_SEARCH_USD = 0.01; // $10 per 1,000 searches

export function costOf(model: string, usage: Anthropic.Beta.BetaUsage): number {
  let [, input, output] = PRICES.find(([p]) => model.startsWith(p)) ?? ["", 5, 25];
  const promptTokens = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  // Haiku 5.5 bills prompts over 100K tokens at a higher rate.
  if (model.startsWith("claude-haiku-5-5") && promptTokens > 100_000) [input, output] = [0.5, 2.5];
  const tokens =
    usage.input_tokens * input +
    (usage.cache_creation_input_tokens ?? 0) * input * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * input * 0.1 +
    usage.output_tokens * output;
  return tokens / 1_000_000 + (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;
}
