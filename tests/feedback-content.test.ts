import { buildFeedbackUserMessage } from "@/lib/feedback-content";
import { describe, expect, it } from "vitest";

describe("buildFeedbackUserMessage", () => {
  it("includes intent and details", () => {
    const msg = buildFeedbackUserMessage({ kind: "bug", text: "Broken" });
    expect(msg).toContain("bug");
    expect(msg).toContain("Broken");
  });

  it("includes optional sections when provided", () => {
    const msg = buildFeedbackUserMessage({
      kind: "feature",
      title: "CSV export",
      text: "Add export",
      contextWhere: "Staging",
      contextPage: "Dashboard",
      contextSteps: "1) Open",
    });
    expect(msg).toContain("Title: CSV export");
    expect(msg).toContain("Where / environment");
    expect(msg).toContain("Staging");
    expect(msg).toContain("Screen or page");
    expect(msg).toContain("Dashboard");
    expect(msg).toContain("Steps to reproduce");
    expect(msg).toContain("1) Open");
  });
});
