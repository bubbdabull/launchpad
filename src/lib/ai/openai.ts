import "server-only";
import OpenAI from "openai";

let cached: OpenAI | null = null;

/** Cached OpenAI client — throws a clear message if `OPENAI_API_KEY` is unset. */
export function getOpenAi(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. Add your key to .env.local and restart `npm run dev`.",
    );
  }
  cached = new OpenAI({ apiKey });
  return cached;
}

/**
 * Default chat model. `gpt-4o-mini` is fast + cheap and supports the
 * structured-output `json_schema` response format we rely on.
 */
export const DEFAULT_AI_MODEL: string =
  process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

/** Whether OpenAI is currently configured — useful for hiding UI when not. */
export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
