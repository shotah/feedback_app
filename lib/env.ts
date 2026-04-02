/**
 * Central checks for route handlers. Auth/OAuth vars are validated by Auth.js at runtime.
 */

import { connectDb } from "@/lib/db";
import { UserSettings, decryptApiKey } from "@/models/UserSettings";

export type ResolvedGithubConfig = {
  pat: string;
  defaultRepo: string;
  defaultBranch: string;
};

export type LlmProvider = "openai" | "anthropic";

export type ResolvedLlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
};

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";

function parseProvider(raw: string | undefined): LlmProvider | null {
  const val = (raw?.trim() || "openai").toLowerCase();
  if (val === "anthropic" || val === "claude") return "anthropic";
  if (val === "openai") return "openai";
  return null;
}

/** Server-side LLM vendor from env. */
export function resolveLlmProvider(): LlmProvider | null {
  return parseProvider(process.env.LLM_PROVIDER);
}

export function missingForFeedbackStorage(): string[] {
  const missing: string[] = [];
  if (!process.env.MONGODB_URI?.trim()) missing.push("MONGODB_URI");
  return missing;
}

/** Single BYOK secret for the configured provider from env. */
export function resolveLlmApiKey(): string | undefined {
  return process.env.LLM_API_KEY?.trim();
}

export function resolveLlmModel(provider: LlmProvider): string {
  const explicit = process.env.LLM_MODEL?.trim();
  if (explicit) return explicit;
  return provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
}

/**
 * Resolve the full LLM config for a user. User settings take priority over env vars.
 * Returns null with a reason string if no usable config is found.
 */
export async function resolveLlmConfigForUser(
  userId: string | undefined,
): Promise<{ config: ResolvedLlmConfig } | { config: null; reason: string }> {
  if (userId) {
    try {
      await connectDb();
      const doc = await UserSettings.findOne({ userId }).lean().exec() as {
        llmProvider?: string;
        llmApiKeyEncrypted?: string;
        llmModel?: string;
      } | null;

      if (doc?.llmApiKeyEncrypted) {
        const provider = parseProvider(doc.llmProvider) ?? "openai";
        const apiKey = decryptApiKey(doc.llmApiKeyEncrypted);
        const model = doc.llmModel?.trim() ||
          (provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL);
        return { config: { provider, apiKey, model } };
      }
    } catch {
      // fall through to env vars
    }
  }

  const provider = resolveLlmProvider();
  if (!provider) {
    return { config: null, reason: "No LLM provider configured. Open Settings and add your API key." };
  }
  const apiKey = resolveLlmApiKey();
  if (!apiKey) {
    return { config: null, reason: "No API key configured. Open Settings and add your API key." };
  }
  const model = resolveLlmModel(provider);
  return { config: { provider, apiKey, model } };
}

/**
 * GitHub PAT + default repo/branch from user settings (encrypted at rest).
 * Used when wiring PR creation / issue APIs; not yet called from routes.
 */
export async function resolveGithubConfigForUser(
  userId: string | undefined,
): Promise<{ config: ResolvedGithubConfig } | { config: null; reason: string }> {
  if (!userId) {
    return { config: null, reason: "Sign in required" };
  }
  try {
    await connectDb();
    const doc = (await UserSettings.findOne({ userId }).lean().exec()) as {
      githubPatEncrypted?: string;
      githubDefaultRepo?: string;
      githubDefaultBranch?: string;
    } | null;

    if (!doc?.githubPatEncrypted) {
      return { config: null, reason: "Add a GitHub PAT in Settings (GitHub section)." };
    }
    const defaultRepo = doc.githubDefaultRepo?.trim() ?? "";
    if (!defaultRepo) {
      return { config: null, reason: "Set default GitHub repository (owner/repo) in Settings." };
    }
    const pat = decryptApiKey(doc.githubPatEncrypted);
    const defaultBranch = doc.githubDefaultBranch?.trim() || "main";
    return { config: { pat, defaultRepo, defaultBranch } };
  } catch {
    return { config: null, reason: "Could not load GitHub settings." };
  }
}

export function missingForLlmProcess(): string[] {
  const missing = [...missingForFeedbackStorage()];
  return missing;
}
