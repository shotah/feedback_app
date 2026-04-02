import { missingForLlmProcess, resolveLlmApiKey, resolveLlmModel, resolveLlmProvider } from "@/lib/env";
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

  it("requires LLM_API_KEY", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://x");
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("LLM_API_KEY", "");
    delete process.env.LLM_API_KEY;
    expect(missingForLlmProcess()).toContain("LLM_API_KEY");
  });

  it("passes when LLM_API_KEY set", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://x");
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("LLM_API_KEY", "x");
    expect(missingForLlmProcess()).toEqual([]);
  });
});
