import type { FeedbackKind } from "@/models/Feedback";

export type FeedbackContentInput = {
  kind: FeedbackKind;
  title?: string;
  text: string;
  contextWhere?: string;
  contextPage?: string;
  contextSteps?: string;
};

const KIND_HINT: Record<FeedbackKind, string> = {
  feature: "new capability or incremental change to the product",
  bug: "something broken, incorrect, or blocking usage",
  other: "general feedback that is not clearly a feature or bug",
};

export function buildFeedbackUserMessage(input: FeedbackContentInput): string {
  const lines: string[] = [
    `Intent: ${input.kind} — ${KIND_HINT[input.kind]}`,
  ];
  const t = input.title?.trim();
  if (t) lines.push(`Title: ${t}`);
  lines.push(`Details:\n${input.text.trim()}`);
  const w = input.contextWhere?.trim();
  if (w) lines.push(`Where / environment:\n${w}`);
  const p = input.contextPage?.trim();
  if (p) lines.push(`Screen or page:\n${p}`);
  const s = input.contextSteps?.trim();
  if (s) lines.push(`Steps to reproduce:\n${s}`);
  return lines.join("\n\n");
}
