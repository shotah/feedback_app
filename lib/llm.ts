import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import type { ResolvedLlmConfig } from "@/lib/env";
import { FEEDBACK_ANALYSIS_SYSTEM, CODEGEN_SYSTEM } from "@/lib/prompts";

export const FeedbackAiJsonSchema = z.object({
  refused: z.boolean(),
  summary: z.string(),
  proposedSteps: z.array(z.string()),
  risks: z.array(z.string()),
  outOfScope: z.array(z.string()),
  doNotDo: z.array(z.string()),
});

export type FeedbackAiResult = z.infer<typeof FeedbackAiJsonSchema>;

export function safeParseLlmFeedbackJson(json: unknown) {
  return FeedbackAiJsonSchema.safeParse(json);
}

const JSON_ONLY_SUFFIX =
  "\n\nRespond with a single JSON object only (no markdown code fences, no prose before or after).";

function parseModelJson(raw: string): unknown {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*/i;
  if (fence.test(s)) {
    s = s.replace(fence, "");
    s = s.replace(/\s*```\s*$/i, "");
  }
  return JSON.parse(s) as unknown;
}

function validateParsedJson(json: unknown, raw: string): { parsed: FeedbackAiResult; raw: string } {
  const parsed = FeedbackAiJsonSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("LLM JSON did not match expected shape");
  }
  return { parsed: parsed.data, raw };
}

async function callOpenAI(
  apiKey: string,
  model: string,
  feedbackText: string,
): Promise<{ parsed: FeedbackAiResult; raw: string }> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: FEEDBACK_ANALYSIS_SYSTEM },
      { role: "user", content: `User feedback:\n${feedbackText}` },
    ],
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  let json: unknown;
  try {
    json = parseModelJson(raw);
  } catch {
    throw new Error("LLM returned non-JSON");
  }
  return validateParsedJson(json, raw);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  feedbackText: string,
): Promise<{ parsed: FeedbackAiResult; raw: string }> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model,
    max_tokens: 8192,
    system: `${FEEDBACK_ANALYSIS_SYSTEM}${JSON_ONLY_SUFFIX}`,
    messages: [{ role: "user", content: `User feedback:\n${feedbackText}` }],
  });
  const textBlocks = msg.content.filter((b) => b.type === "text");
  const raw = textBlocks.map((b) => b.text).join("") || "{}";
  let json: unknown;
  try {
    json = parseModelJson(raw);
  } catch {
    throw new Error("LLM returned non-JSON");
  }
  return validateParsedJson(json, raw);
}

export async function analyzeFeedbackText(
  feedbackText: string,
  llmConfig: ResolvedLlmConfig,
): Promise<{
  parsed: FeedbackAiResult;
  raw: string;
}> {
  const { provider, apiKey, model } = llmConfig;
  if (provider === "openai") {
    return callOpenAI(apiKey, model, feedbackText);
  }
  return callAnthropic(apiKey, model, feedbackText);
}

export const CodegenFileSchema = z.object({
  path: z.string(),
  action: z.enum(["create", "edit", "delete"]),
  content: z.string(),
});

export const CodegenResultSchema = z.object({
  files: z.array(CodegenFileSchema),
});

export type CodegenResult = z.infer<typeof CodegenResultSchema>;

export async function generateCode(
  approvedSteps: string[],
  originalFeedback: string,
  llmConfig: ResolvedLlmConfig,
): Promise<{ parsed: CodegenResult; raw: string }> {
  const { provider, apiKey, model } = llmConfig;
  const userMsg = `Original feedback:\n${originalFeedback}\n\nApproved implementation plan:\n${approvedSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
  const jsonSuffix = "\n\nRespond with a single JSON object only (no markdown code fences, no prose).";

  let raw: string;
  if (provider === "openai") {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: CODEGEN_SYSTEM },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    });
    raw = completion.choices[0]?.message?.content ?? "{}";
  } else {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: 16384,
      system: `${CODEGEN_SYSTEM}${jsonSuffix}`,
      messages: [{ role: "user", content: userMsg }],
    });
    const textBlocks = msg.content.filter((b) => b.type === "text");
    raw = textBlocks.map((b) => b.text).join("") || "{}";
  }

  let json: unknown;
  try {
    json = parseModelJson(raw);
  } catch {
    throw new Error("LLM returned non-JSON for code generation");
  }
  const parsed = CodegenResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Code generation output did not match expected shape");
  }
  return { parsed: parsed.data, raw };
}
