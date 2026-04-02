/**
 * Central checks for route handlers. Auth/OAuth vars are validated by Auth.js at runtime.
 */

export type LlmProvider = "openai" | "anthropic";

/** Server-side LLM vendor (BYOK). `claude` is accepted as an alias for `anthropic`. */
export function resolveLlmProvider(): LlmProvider | null {
  const raw = (process.env.LLM_PROVIDER?.trim() || "openai").toLowerCase();
  if (raw === "anthropic" || raw === "claude") return "anthropic";
  if (raw === "openai") return "openai";
  return null;
}

export function missingForFeedbackStorage(): string[] {
  const missing: string[] = [];
  if (!process.env.MONGODB_URI?.trim()) missing.push("MONGODB_URI");
  return missing;
}

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";

/** Single BYOK secret for the configured provider. */
export function resolveLlmApiKey(): string | undefined {
  return process.env.LLM_API_KEY?.trim();
}

/**
 * Model id for the Messages / Chat Completions call.
 * If `LLM_MODEL` is unset, defaults by provider (see constants in `lib/env.ts`).
 */
export function resolveLlmModel(provider: LlmProvider): string {
  const explicit = process.env.LLM_MODEL?.trim();
  if (explicit) return explicit;
  return provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
}

export function missingForLlmProcess(): string[] {
  const missing = [...missingForFeedbackStorage()];
  const provider = resolveLlmProvider();
  if (!provider) {
    missing.push('LLM_PROVIDER must be "openai" or "anthropic" (alias: "claude")');
    return missing;
  }
  if (!resolveLlmApiKey()) {
    missing.push("LLM_API_KEY");
  }
  return missing;
}
