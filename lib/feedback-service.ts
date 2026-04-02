import { buildFeedbackUserMessage } from "@/lib/feedback-content";
import { connectDb } from "@/lib/db";
import { analyzeFeedbackText, generateCode, type CodegenResult } from "@/lib/llm";
import { resolveGithubConfigForUser, resolveLlmConfigForUser } from "@/lib/env";
import { createGithubIssue, formatApprovedPlanIssueBody, parseOwnerRepo } from "@/lib/github-issue";
import { Feedback, type FeedbackKind } from "@/models/Feedback";
import mongoose from "mongoose";
import { writeFile, mkdir, unlink } from "fs/promises";
import { dirname, resolve } from "path";
import { execSync } from "child_process";

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

export async function updatePendingFeedback(
  feedbackId: string,
  userId: string,
  input: {
    text: string;
    title?: string;
    kind?: FeedbackKind;
    contextWhere?: string;
    contextPage?: string;
    contextSteps?: string;
  },
) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const doc = await Feedback.findOne({ _id: feedbackId, userId }).exec();
  if (!doc) return { ok: false as const, error: "Not found" };
  if (doc.status !== "pending") {
    return { ok: false as const, error: "Only pending feedback can be edited" };
  }

  doc.text = input.text.trim().slice(0, 8000);
  doc.title = (input.title ?? "").trim().slice(0, 200);
  if (input.kind === "feature" || input.kind === "bug" || input.kind === "other") {
    doc.kind = input.kind;
  }
  doc.contextWhere = input.contextWhere?.trim() || undefined;
  doc.contextPage = input.contextPage?.trim() || undefined;
  doc.contextSteps = input.contextSteps?.trim() || undefined;
  await doc.save();
  return { ok: true as const, doc };
}

export async function deletePendingFeedback(feedbackId: string, userId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const doc = await Feedback.findOne({ _id: feedbackId, userId }).exec();
  if (!doc) return { ok: false as const, error: "Not found" };
  if (doc.status !== "pending") {
    return { ok: false as const, error: "Only pending feedback can be deleted" };
  }
  await Feedback.deleteOne({ _id: feedbackId, userId }).exec();
  return { ok: true as const };
}

export async function runFeedbackProcessing(feedbackId: string, userId?: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const doc = await Feedback.findById(feedbackId);
  if (!doc) return { ok: false as const, error: "Not found" };
  if (doc.status === "processing") {
    return { ok: false as const, error: "Already processing" };
  }

  const llmResult = await resolveLlmConfigForUser(userId);
  if (!llmResult.config) {
    return { ok: false as const, error: llmResult.reason };
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
    const { parsed, raw } = await analyzeFeedbackText(userMessage, llmResult.config);
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

export async function acceptFeedbackPlan(
  feedbackId: string,
  userId: string,
  editedSteps?: string[],
) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const doc = await Feedback.findById(feedbackId);
  if (!doc) return { ok: false as const, error: "Not found" };
  if (doc.userId !== userId) return { ok: false as const, error: "Forbidden" };
  if (!doc.aiOutput?.proposedSteps?.length) {
    return { ok: false as const, error: "No plan to accept — run analysis first" };
  }

  doc.approvedPlan = editedSteps ?? doc.aiOutput.proposedSteps;
  doc.status = "approved";
  doc.errorMessage = undefined;
  await doc.save();
  return { ok: true as const, doc };
}

export async function rejectFeedbackPlan(feedbackId: string, userId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const doc = await Feedback.findById(feedbackId);
  if (!doc) return { ok: false as const, error: "Not found" };
  if (doc.userId !== userId) return { ok: false as const, error: "Forbidden" };

  doc.approvedPlan = undefined;
  doc.codeOutput = undefined;
  doc.status = "done";
  await doc.save();
  return { ok: true as const, doc };
}

export async function createGithubIssueForFeedback(feedbackId: string, userId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const doc = await Feedback.findById(feedbackId);
  if (!doc) return { ok: false as const, error: "Not found" };
  if (doc.userId !== userId) return { ok: false as const, error: "Forbidden" };
  if (doc.status !== "approved" || !doc.approvedPlan?.length) {
    return {
      ok: false as const,
      error: "Approve a plan first. GitHub issues are created only while the ticket is in the approved state.",
    };
  }
  if (doc.githubIssueUrl) {
    return {
      ok: false as const,
      error: "A GitHub issue was already created for this ticket.",
      existingUrl: doc.githubIssueUrl,
    };
  }

  const gh = await resolveGithubConfigForUser(userId);
  if (!gh.config) {
    return { ok: false as const, error: gh.reason };
  }

  const parts = parseOwnerRepo(gh.config.defaultRepo);
  if (!parts) {
    return {
      ok: false as const,
      error: "Set a valid default repository (owner/repo) in Settings.",
    };
  }

  const rawTitle =
    doc.title?.trim() ||
    (doc.text.trim().slice(0, 72) + (doc.text.trim().length > 72 ? "…" : "")) ||
    `Feedback ${feedbackId}`;
  const issueTitle = rawTitle.toLowerCase().startsWith("cyoa:")
    ? rawTitle.slice(0, 256)
    : `CYOA: ${rawTitle}`.slice(0, 256);

  const body = formatApprovedPlanIssueBody({
    feedbackId: String(doc._id),
    title: doc.title ?? "",
    kind: doc.kind ?? "other",
    text: doc.text,
    contextWhere: doc.contextWhere ?? undefined,
    contextPage: doc.contextPage ?? undefined,
    contextSteps: doc.contextSteps ?? undefined,
    approvedPlan: doc.approvedPlan,
    summary: doc.aiOutput?.summary,
  });

  const result = await createGithubIssue({
    token: gh.config.pat,
    owner: parts.owner,
    repo: parts.repo,
    title: issueTitle,
    body,
  });

  if ("error" in result) {
    const hint =
      result.status === 401 || result.status === 403
        ? " Check the PAT in Settings (issues: write, and access to this repo)."
        : "";
    return { ok: false as const, error: `${result.error}${hint}` };
  }

  doc.githubIssueUrl = result.html_url;
  doc.githubIssueNumber = result.number;
  await doc.save();

  return { ok: true as const, url: result.html_url, number: result.number };
}

export async function runCodeGeneration(feedbackId: string, userId?: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const doc = await Feedback.findById(feedbackId);
  if (!doc) return { ok: false as const, error: "Not found" };
  if (doc.status !== "approved" || !doc.approvedPlan?.length) {
    return { ok: false as const, error: "Plan must be approved before code generation" };
  }

  const llmResult = await resolveLlmConfigForUser(userId);
  if (!llmResult.config) {
    return { ok: false as const, error: llmResult.reason };
  }

  doc.status = "applying";
  doc.errorMessage = undefined;
  await doc.save();

  try {
    const feedbackText = buildFeedbackUserMessage({
      kind: docKind(doc),
      title: doc.title || undefined,
      text: doc.text,
    });
    const { parsed, raw } = await generateCode(doc.approvedPlan, feedbackText, llmResult.config);
    doc.codeOutput = raw;
    doc.status = "approved";
    await doc.save();
    return { ok: true as const, doc, files: parsed.files };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    doc.status = "error";
    doc.errorMessage = message;
    await doc.save();
    return { ok: false as const, error: message };
  }
}

export async function applyCodeOutput(feedbackId: string, userId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(feedbackId)) {
    return { ok: false as const, error: "Invalid id" };
  }
  const doc = await Feedback.findById(feedbackId);
  if (!doc) return { ok: false as const, error: "Not found" };
  if (doc.userId !== userId) return { ok: false as const, error: "Forbidden" };
  if (!doc.codeOutput) {
    return { ok: false as const, error: "No code output to apply — run code generation first" };
  }

  let files: CodegenResult["files"];
  try {
    const parsed = JSON.parse(doc.codeOutput) as { files?: CodegenResult["files"] };
    files = parsed.files ?? [];
  } catch {
    return { ok: false as const, error: "Could not parse stored code output" };
  }

  const projectRoot = resolve(".");
  const applied: string[] = [];

  try {
    for (const file of files) {
      const target = resolve(projectRoot, file.path);
      if (!target.startsWith(projectRoot)) {
        throw new Error(`Path traversal blocked: ${file.path}`);
      }
      if (file.action === "delete") {
        await unlink(target).catch(() => {});
        applied.push(`deleted ${file.path}`);
      } else {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.content, "utf-8");
        applied.push(`${file.action === "create" ? "created" : "edited"} ${file.path}`);
      }
    }

    doc.status = "applied";
    doc.appliedAt = new Date();
    doc.applyResult = applied.join("\n");
    doc.errorMessage = undefined;
    await doc.save();
    return { ok: true as const, doc, applied };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    doc.status = "error";
    doc.errorMessage = message;
    await doc.save();
    return { ok: false as const, error: message };
  }
}

export function runVerification(): { ok: boolean; output: string } {
  try {
    const output = execSync(
      "npm run lint 2>&1 && npx tsc --noEmit 2>&1 && npm run test 2>&1",
      { encoding: "utf-8", timeout: 60_000, cwd: resolve(".") },
    );
    return { ok: true, output };
  } catch (e) {
    const output = (e as { stdout?: string; stderr?: string }).stdout ?? "";
    return { ok: false, output };
  }
}
