import { auth } from "@/auth";
import {
  getFeedbackById,
  updateFeedbackTitle,
  updatePendingFeedback,
  deletePendingFeedback,
  acceptFeedbackPlan,
  rejectFeedbackPlan,
} from "@/lib/feedback-service";
import { missingForFeedbackStorage } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const titleBodySchema = z.object({ title: z.string().max(200) }).strict();

const pendingBodySchema = z.object({
  text: z.string().min(1).max(8000),
  title: z.string().max(200).optional(),
  kind: z.enum(["feature", "bug", "other"]).optional(),
  contextWhere: z.string().max(2000).optional(),
  contextPage: z.string().max(500).optional(),
  contextSteps: z.string().max(4000).optional(),
});

const actionBodySchema = z.object({
  action: z.enum(["accept", "reject"]),
  editedSteps: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const mis = missingForFeedbackStorage();
  if (mis.length) {
    return NextResponse.json({ error: "Missing env vars", missing: mis }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const doc = await getFeedbackById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (doc.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const actionParsed = actionBodySchema.safeParse(json);
  if (actionParsed.success) {
    const { action, editedSteps } = actionParsed.data;
    if (action === "accept") {
      const result = await acceptFeedbackPlan(id, session.user.id, editedSteps);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ id: result.doc.id, status: result.doc.status });
    }
    const result = await rejectFeedbackPlan(id, session.user.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ id: result.doc.id, status: result.doc.status });
  }

  const pendingParsed = pendingBodySchema.safeParse(json);
  if (pendingParsed.success && doc.status === "pending") {
    const result = await updatePendingFeedback(id, session.user.id, pendingParsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ id: result.doc.id, status: result.doc.status });
  }

  if (pendingParsed.success && doc.status !== "pending") {
    return NextResponse.json(
      { error: "Full edit is only allowed while feedback is pending" },
      { status: 400 },
    );
  }

  const titleParsed = titleBodySchema.safeParse(json);
  if (!titleParsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await updateFeedbackTitle(id, session.user.id, titleParsed.data.title);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ id: result.doc.id, title: result.doc.title });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const mis = missingForFeedbackStorage();
  if (mis.length) {
    return NextResponse.json({ error: "Missing env vars", missing: mis }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const doc = await getFeedbackById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (doc.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await deletePendingFeedback(id, session.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
