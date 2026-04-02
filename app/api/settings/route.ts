import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import {
  UserSettings,
  encryptApiKey,
} from "@/models/UserSettings";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const OWNER_REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

const putSchema = z.object({
  llmProvider: z.enum(["openai", "anthropic"]),
  llmApiKey: z.string().min(1).max(500).optional(),
  llmModel: z.string().max(100).optional(),
  githubPat: z.string().min(1).max(500).optional(),
  githubDefaultRepo: z.string().max(200).optional(),
  githubDefaultBranch: z.string().max(255).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDb();
  const doc = await UserSettings.findOne({ userId: session.user.id }).lean().exec();

  const repo = (doc?.githubDefaultRepo ?? "").trim();

  return NextResponse.json({
    llmProvider: doc?.llmProvider ?? process.env.LLM_PROVIDER ?? "openai",
    llmModel: doc?.llmModel ?? process.env.LLM_MODEL ?? "",
    hasApiKey: Boolean(doc?.llmApiKeyEncrypted) || Boolean(process.env.LLM_API_KEY),
    isUserKey: Boolean(doc?.llmApiKeyEncrypted),
    githubDefaultRepo: repo,
    githubDefaultBranch: (doc?.githubDefaultBranch ?? "main").trim() || "main",
    hasGithubPat: Boolean(doc?.githubPatEncrypted),
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const repoIn = parsed.data.githubDefaultRepo?.trim() ?? "";
  if (repoIn && !OWNER_REPO.test(repoIn)) {
    return NextResponse.json(
      { error: "githubDefaultRepo must look like owner/repo (alphanumeric, dots, dashes, underscores)" },
      { status: 400 },
    );
  }

  await connectDb();
  const update: Record<string, unknown> = {
    llmProvider: parsed.data.llmProvider,
    llmModel: parsed.data.llmModel?.trim() ?? "",
  };
  if (parsed.data.llmApiKey) {
    update.llmApiKeyEncrypted = encryptApiKey(parsed.data.llmApiKey);
  }
  if (parsed.data.githubPat) {
    update.githubPatEncrypted = encryptApiKey(parsed.data.githubPat);
  }
  if (parsed.data.githubDefaultRepo !== undefined) {
    update.githubDefaultRepo = repoIn;
  }
  if (parsed.data.githubDefaultBranch !== undefined) {
    const b = parsed.data.githubDefaultBranch.trim();
    update.githubDefaultBranch = b || "main";
  }

  await UserSettings.findOneAndUpdate(
    { userId: session.user.id },
    { $set: update },
    { upsert: true },
  ).exec();

  return NextResponse.json({ ok: true });
}
