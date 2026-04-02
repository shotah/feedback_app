import { missingForLlmProcess, missingForFeedbackStorage, resolveLlmApiKey, resolveLlmModel, resolveLlmProvider } from "@/lib/env";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveLlmProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to openai when unset or blank", () => {
    vi.unstubAllEnvs();
    delete process.env.LLM_PROVIDER;
    expect(resolveLlmProvider()).toBe("openai");
    vi.stubEnv("LLM_PROVIDER", "   ");
    expect(resolveLlmProvider()).toBe("openai");
  });

  it("accepts anthropic and claude alias", () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    expect(resolveLlmProvider()).toBe("anthropic");
    vi.stubEnv("LLM_PROVIDER", "claude");
    expect(resolveLlmProvider()).toBe("anthropic");
  });

  it("returns null for unknown provider", () => {
    vi.stubEnv("LLM_PROVIDER", "azure");
    expect(resolveLlmProvider()).toBeNull();
  });
});

describe("resolveLlmApiKey / resolveLlmModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads LLM_API_KEY", () => {
    vi.stubEnv("LLM_API_KEY", "sk-test");
    expect(resolveLlmApiKey()).toBe("sk-test");
  });

  it("defaults model by provider when LLM_MODEL unset", () => {
    delete process.env.LLM_MODEL;
    expect(resolveLlmModel("openai")).toBe("gpt-4o-mini");
    expect(resolveLlmModel("anthropic")).toBe("claude-3-5-haiku-20241022");
  });

  it("uses LLM_MODEL when set", () => {
    vi.stubEnv("LLM_MODEL", "custom-model");
    expect(resolveLlmModel("openai")).toBe("custom-model");
    expect(resolveLlmModel("anthropic")).toBe("custom-model");
  });
});

describe("missingForLlmProcess", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only checks MONGODB_URI (LLM keys are per-user now)", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://x");
    expect(missingForLlmProcess()).toEqual([]);
  });

  it("reports missing MONGODB_URI", () => {
    delete process.env.MONGODB_URI;
    expect(missingForLlmProcess()).toContain("MONGODB_URI");
  });
});

describe("missingForFeedbackStorage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports missing MONGODB_URI", () => {
    delete process.env.MONGODB_URI;
    expect(missingForFeedbackStorage()).toContain("MONGODB_URI");
  });

  it("passes when MONGODB_URI set", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://x");
    expect(missingForFeedbackStorage()).toEqual([]);
  });
});
