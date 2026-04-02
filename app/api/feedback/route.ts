import { auth } from "@/auth";
import { createFeedback, listFeedbackForUser } from "@/lib/feedback-service";
import { missingForFeedbackStorage } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const feedbackCreateSchema = z.object({
  text: z.string().min(1).max(8000),
  title: z.string().max(200).optional(),
  kind: z.enum(["feature", "bug", "other"]).optional(),
  contextWhere: z.string().max(2000).optional(),
  contextPage: z.string().max(500).optional(),
  contextSteps: z.string().max(4000).optional(),
});

const postApiBodySchema = feedbackCreateSchema.extend({
  userId: z.string().min(1).max(256),
});

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function GET() {
  const mis = missingForFeedbackStorage();
  if (mis.length) {
    return NextResponse.json({ error: "Server misconfiguration", missing: mis }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await listFeedbackForUser(session.user.id);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const mis = missingForFeedbackStorage();
  if (mis.length) {
    return NextResponse.json({ error: "Server misconfiguration", missing: mis }, { status: 503 });
  }

  const ingestKey = process.env.FEEDBACK_INGEST_API_KEY;
  const authHeader = req.headers.get("authorization");
  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;

  if (bearer && ingestKey && bearer === ingestKey) {
    if (!rateLimit(`ingest:${clientKey(req)}`, 60, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = postApiBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { userId, ...rest } = parsed.data;
    const doc = await createFeedback({
      userId,
      text: rest.text,
      source: "api",
      title: rest.title,
      kind: rest.kind,
      contextWhere: rest.contextWhere,
      contextPage: rest.contextPage,
      contextSteps: rest.contextSteps,
    });
    return NextResponse.json({ id: doc.id, status: doc.status });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`ui:${session.user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = feedbackCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const doc = await createFeedback({
    userId: session.user.id,
    text: parsed.data.text,
    source: "ui",
    title: parsed.data.title,
    kind: parsed.data.kind,
    contextWhere: parsed.data.contextWhere,
    contextPage: parsed.data.contextPage,
    contextSteps: parsed.data.contextSteps,
  });
  return NextResponse.json({ id: doc.id, status: doc.status });
}
