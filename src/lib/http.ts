import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ConfigError, ResearchFailedError, type Costed } from "./ai";

/** JSON body `{ [key]: value, cost }`, logging the cost for the Vercel logs. */
export function costed<T>(step: string, result: Costed<T>, key: string) {
  if (result.cost != null) console.info(`[cost] ${step} $${result.cost.toFixed(4)}`);
  return { [key]: result.value, cost: result.cost };
}

export function errorResponse(err: unknown) {
  console.error(err);
  if (err instanceof ConfigError) return Response.json({ error: err.message }, { status: 400 });
  // 503 so the client's one automatic retry kicks in.
  if (err instanceof ResearchFailedError) return Response.json({ error: err.message }, { status: 503 });
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "Rate limited by the AI provider. Wait a minute and retry." }, { status: 429 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: "AI provider rejected the API key." }, { status: 500 });
  }
  if (err instanceof Anthropic.APIError) {
    return Response.json({ error: `AI provider error (${err.status}).` }, { status: 502 });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}
