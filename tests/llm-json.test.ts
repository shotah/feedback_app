import { safeParseLlmFeedbackJson } from "@/lib/llm";
import { describe, expect, it } from "vitest";

describe("safeParseLlmFeedbackJson", () => {
  it("accepts a valid payload", () => {
    const parsed = safeParseLlmFeedbackJson({
      refused: false,
      summary: "ok",
      proposedSteps: ["a"],
      risks: [],
      outOfScope: [],
      doNotDo: ["no rm -rf"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.summary).toBe("ok");
    }
  });

  it("rejects invalid shapes", () => {
    const parsed = safeParseLlmFeedbackJson({ summary: "only summary" });
    expect(parsed.success).toBe(false);
  });
});
