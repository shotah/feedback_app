/**
 * Create a GitHub Issue via REST (no Octokit — keeps dependencies minimal).
 */

const GH_ACCEPT = "application/vnd.github+json";
const GH_API_VERSION = "2022-11-28";

export function parseOwnerRepo(full: string): { owner: string; repo: string } | null {
  const i = full.indexOf("/");
  if (i <= 0 || i === full.length - 1) return null;
  const owner = full.slice(0, i).trim();
  const repo = full.slice(i + 1).trim();
  if (!owner || !repo || repo.includes("/")) return null;
  return { owner, repo };
}

export function formatApprovedPlanIssueBody(input: {
  feedbackId: string;
  title: string;
  kind: string;
  text: string;
  contextWhere?: string;
  contextPage?: string;
  contextSteps?: string;
  approvedPlan: string[];
  summary?: string;
}): string {
  const lines: string[] = [
    "_This issue was opened from **CYOA** with an **approved implementation plan**._",
    "",
    `**CYOA feedback id:** \`${input.feedbackId}\``,
    "",
    "## Summary",
    input.summary?.trim() || "_(none)_",
    "",
    "## Original feedback",
    input.text.trim(),
    "",
    `**Kind:** ${input.kind}`,
  ];
  if (input.title?.trim()) {
    lines.push(`**Title:** ${input.title.trim()}`);
  }
  if (input.contextWhere?.trim()) lines.push("", "**Where / environment**", input.contextWhere.trim());
  if (input.contextPage?.trim()) lines.push("", "**Page / screen**", input.contextPage.trim());
  if (input.contextSteps?.trim()) lines.push("", "**Steps**", input.contextSteps.trim());

  lines.push("", "## Approved plan", "");
  input.approvedPlan.forEach((step, i) => {
    lines.push(`${i + 1}. ${step.trim()}`);
  });
  lines.push("", "---", "_Implement via PR, Claude/GitHub integrations, or your usual workflow._");
  return lines.join("\n");
}

export async function createGithubIssue(params: {
  token: string;
  owner: string;
  repo: string;
  title: string;
  body: string;
}): Promise<{ html_url: string; number: number } | { error: string; status?: number }> {
  const res = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: GH_ACCEPT,
      "X-GitHub-Api-Version": GH_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: params.title.slice(0, 256),
      body: params.body.slice(0, 65_000),
    }),
  });

  const data = (await res.json()) as { message?: string; html_url?: string; number?: number };

  if (!res.ok) {
    const msg = data.message ?? res.statusText ?? "GitHub API error";
    return { error: msg, status: res.status };
  }

  if (!data.html_url || typeof data.number !== "number") {
    return { error: "Unexpected GitHub response" };
  }

  return { html_url: data.html_url, number: data.number };
}
