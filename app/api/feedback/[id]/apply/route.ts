import { auth } from "@/auth";
import {
  runCodeGeneration,
  applyCodeOutput,
  runVerification,
} from "@/lib/feedback-service";
import { missingForFeedbackStorage } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/feedback/:id/apply
 *
 * Runs code generation from the approved plan, applies file changes to the
 * working tree, then runs lint + types + tests and reports the result.
 *
 * EXPERIMENTAL: this writes files to the server's filesystem. Use at your
 * own risk. Changes can be reverted with `git checkout .` or `git stash`.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mis = missingForFeedbackStorage();
  if (mis.length) {
    return NextResponse.json({ error: "Missing env vars", missing: mis }, { status: 503 });
  }

  const { id } = await context.params;

  const codegenResult = await runCodeGeneration(id, session.user.id);
  if (!codegenResult.ok) {
    return NextResponse.json({ error: codegenResult.error }, { status: 400 });
  }

  const applyResult = await applyCodeOutput(id, session.user.id);
  if (!applyResult.ok) {
    return NextResponse.json({ error: applyResult.error }, { status: 400 });
  }

  const verification = runVerification();

  return NextResponse.json({
    id,
    status: "applied",
    applied: applyResult.applied,
    verification: {
      passed: verification.ok,
      output: verification.output.slice(0, 4000),
    },
  });
}
