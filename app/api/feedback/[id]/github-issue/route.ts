import { auth } from "@/auth";
import { createGithubIssueForFeedback } from "@/lib/feedback-service";
import { missingForFeedbackStorage } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/feedback/:id/github-issue
 *
 * Creates a GitHub Issue in the user's default repo (Settings) with the
 * approved plan and original feedback body. Requires PAT + owner/repo in Settings.
 */
export async function POST(
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
  const result = await createGithubIssueForFeedback(id, session.user.id);

  if (!result.ok) {
    const status =
      "existingUrl" in result && result.existingUrl ? 409 : 400;
    return NextResponse.json(
      {
        error: result.error,
        ...("existingUrl" in result && result.existingUrl
          ? { existingUrl: result.existingUrl }
          : {}),
      },
      { status },
    );
  }

  return NextResponse.json({
    url: result.url,
    number: result.number,
  });
}
