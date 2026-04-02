import { buildFeedbackUserMessage } from "@/lib/feedback-content";
import { connectDb } from "@/lib/db";
import { analyzeFeedbackText } from "@/lib/llm";
import { Feedback, type FeedbackKind } from "@/models/Feedback";
import mongoose from "mongoose";

function docKind(doc: { kind?: string }): FeedbackKind {
  if (doc.kind === "feature" || doc.kind === "bug" || doc.kind === "other") {
    return doc.kind;
  }
  return "other";
}

export async function listFeedbackForUser(userId: string, limit = 50) {
  await connectDb();
  return Feedback.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();
}

export async function createFeedback(input: {
  userId: string;
  text: string;
  source: "ui" | "api";
  title?: string;
  kind?: FeedbackKind;
  contextWhere?: string;
  contextPage?: string;
  contextSteps?: string;
}) {
  await connectDb();
  return Feedback.create({
    userId: input.userId,
    text: input.text,
    source: input.source,
    status: "pending",
    title: input.title?.trim().slice(0, 200) ?? "",
    kind: input.kind ?? "other",
    contextWhere: input.contextWhere?.trim() || undefined,
    contextPage: input.contextPage?.trim() || undefined,
    contextSteps: input.contextSteps?.trim() || undefined,
  });
}

export async function getFeedbackById(id: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(id)) return null;
  return Feedback.findById(id).lean().exec();
}

export async function updateFeedbackTitle(feedbackId: string, userId: string, title: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const next = title.trim().slice(0, 200);
  const doc = await Feedback.findOneAndUpdate(
    { _id: feedbackId, userId },
    { $set: { title: next } },
    { new: true },
  ).exec();
  if (!doc) return { ok: false as const, error: "Not found" };
  return { ok: true as const, doc };
}

export async function runFeedbackProcessing(feedbackId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const doc = await Feedback.findById(feedbackId);
  if (!doc) return { ok: false as const, error: "Not found" };
  if (doc.status === "processing") {
    return { ok: false as const, error: "Already processing" };
  }

  const wasDone = doc.status === "done";
  doc.status = "processing";
  doc.errorMessage = undefined;
  if (wasDone) {
    doc.aiOutput = undefined;
    doc.aiRaw = undefined;
  }
  await doc.save();

  try {
    const userMessage = buildFeedbackUserMessage({
      kind: docKind(doc),
      title: doc.title || undefined,
      text: doc.text,
      contextWhere: doc.contextWhere || undefined,
      contextPage: doc.contextPage || undefined,
      contextSteps: doc.contextSteps || undefined,
    });
    const { parsed, raw } = await analyzeFeedbackText(userMessage);
    doc.aiOutput = {
      refused: parsed.refused,
      summary: parsed.summary,
      proposedSteps: parsed.proposedSteps,
      risks: parsed.risks,
      outOfScope: parsed.outOfScope,
      doNotDo: parsed.doNotDo,
    };
    doc.aiRaw = raw;
    doc.status = "done";
    await doc.save();
    return { ok: true as const, doc, reanalyzed: wasDone };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    doc.status = "error";
    doc.errorMessage = message;
    await doc.save();
    return { ok: true as const, doc, reanalyzed: wasDone };
  }
}
