import { auth } from "@/auth";
import { getFeedbackById, runFeedbackProcessing } from "@/lib/feedback-service";
import { missingForLlmProcess } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

async function canProcess(
  req: NextRequest,
  feedbackId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const ingestKey = process.env.FEEDBACK_INGEST_API_KEY;
  const authHeader = req.headers.get("authorization");
  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;

  if (bearer && ingestKey && bearer === ingestKey) {
    return { ok: true };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  const doc = await getFeedbackById(feedbackId);
  if (!doc) {
    return { ok: false, status: 404, message: "Not found" };
  }
  if (doc.userId !== session.user.id) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return { ok: true };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const gate = await canProcess(req, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const mis = missingForLlmProcess();
  if (mis.length) {
    return NextResponse.json({ error: "Server misconfiguration", missing: mis }, { status: 503 });
  }

  const session = await auth();
  const authHeader = req.headers.get("authorization");
  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
  const ingestKey = process.env.FEEDBACK_INGEST_API_KEY;
  const isApi = Boolean(bearer && ingestKey && bearer === ingestKey);
  const rateKey = isApi ? `process-api:${id}` : `process-ui:${session?.user?.id ?? "anon"}:${id}`;
  if (!rateLimit(rateKey, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const result = await runFeedbackProcessing(id);
  if (!result.ok) {
    const status = result.error === "Not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({
    id: result.doc.id,
    status: result.doc.status,
    reanalyzed: result.reanalyzed,
    errorMessage: result.doc.errorMessage ?? undefined,
  });
}
