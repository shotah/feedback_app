import { FEEDBACK_ANALYSIS_SYSTEM } from "@/lib/prompts";
import { describe, expect, it } from "vitest";

describe("FEEDBACK_ANALYSIS_SYSTEM prompt", () => {
  it("contains the project context block", () => {
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("Project context");
  });

  it("references the vinext runtime", () => {
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("vinext");
  });

  it("references Mongoose and models directory", () => {
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("Mongoose");
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("models/");
  });

  it("references Auth.js and auth.ts", () => {
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("Auth.js");
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("auth.ts");
  });

  it("references API route pattern", () => {
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("app/api/");
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("route.ts");
  });

  it("instructs to name files in proposedSteps", () => {
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("name the file(s) to create or edit");
  });

  it("requires quality gates (lint, types, tests)", () => {
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("npm run lint");
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("tsc --noEmit");
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("npm run test");
  });

  it("still requires the JSON output keys", () => {
    for (const key of ["refused", "summary", "proposedSteps", "risks", "outOfScope", "doNotDo"]) {
      expect(FEEDBACK_ANALYSIS_SYSTEM).toContain(`"${key}"`);
    }
  });

  it("still contains safety rules", () => {
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("refused");
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("dangerous");
    expect(FEEDBACK_ANALYSIS_SYSTEM).toContain("delete production data");
  });
});
