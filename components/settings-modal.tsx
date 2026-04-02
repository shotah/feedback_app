"use client";

import { useCallback, useEffect, useState } from "react";

type Settings = {
  llmProvider: "openai" | "anthropic";
  llmModel: string;
  hasApiKey: boolean;
  isUserKey: boolean;
  githubDefaultRepo: string;
  githubDefaultBranch: string;
  hasGithubPat: boolean;
};

export function SettingsModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [isUserKey, setIsUserKey] = useState(false);

  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [githubPat, setGithubPat] = useState("");
  const [hasGithubPat, setHasGithubPat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = (await res.json()) as Settings;
      setProvider(data.llmProvider);
      setModel(data.llmModel);
      setHasExistingKey(data.hasApiKey);
      setIsUserKey(data.isUserKey);
      setGithubRepo(data.githubDefaultRepo ?? "");
      setGithubBranch(data.githubDefaultBranch ?? "main");
      setHasGithubPat(data.hasGithubPat ?? false);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) {
      load();
      setApiKey("");
      setGithubPat("");
      setError(null);
      setSuccess(false);
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const save = useCallback(async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const body: Record<string, string> = { llmProvider: provider };
      if (model.trim()) body.llmModel = model.trim();
      if (apiKey.trim()) body.llmApiKey = apiKey.trim();
      body.githubDefaultRepo = githubRepo.trim();
      body.githubDefaultBranch = githubBranch.trim() || "main";
      if (githubPat.trim()) body.githubPat = githubPat.trim();
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data as { error?: string })?.error ?? "Save failed");
      }
      setApiKey("");
      setGithubPat("");
      setSuccess(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [provider, model, apiKey, githubRepo, githubBranch, githubPat, load]);

  return (
    <>
      <button type="button" className="btn ghost" onClick={() => setOpen(true)}>
        Settings
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button type="button" className="btn ghost modal-close" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            {loading ? (
              <p className="muted">Loading...</p>
            ) : (
              <>
                <h3 className="settings-section-title">LLM</h3>
                <div className="field">
                  <label htmlFor="s-provider">Provider</label>
                  <select
                    id="s-provider"
                    className="select"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as "openai" | "anthropic")}
                    disabled={saving}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="s-key">
                    API Key{" "}
                    {hasExistingKey ? (
                      <span className="muted small">
                        ({isUserKey ? "your key saved" : "server key configured"} — enter a new one to replace)
                      </span>
                    ) : (
                      <span className="muted small">(required)</span>
                    )}
                  </label>
                  <input
                    id="s-key"
                    className="input"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasExistingKey ? "Leave empty to keep current key" : "sk-... or sk-ant-..."}
                    disabled={saving}
                    autoComplete="off"
                  />
                </div>

                <div className="field">
                  <label htmlFor="s-model">
                    Model <span className="muted small">(optional — defaults: gpt-4o-mini / claude-3-5-haiku)</span>
                  </label>
                  <input
                    id="s-model"
                    className="input"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. gpt-4o, claude-sonnet-4-20250514"
                    disabled={saving}
                  />
                </div>

                <h3 className="settings-section-title">GitHub</h3>
                <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                  After you <strong>approve a plan</strong>, you can <strong>Create GitHub issue</strong> on the ticket to
                  post the plan to your default repo. Use a classic PAT with <code className="inline-code">repo</code> or
                  a fine-grained token with <strong>Issues: write</strong> on that repository.
                </p>

                <div className="field">
                  <label htmlFor="s-gh-repo">Default repository</label>
                  <input
                    id="s-gh-repo"
                    className="input"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="owner/repo"
                    disabled={saving}
                    autoComplete="off"
                  />
                </div>

                <div className="field">
                  <label htmlFor="s-gh-branch">Base branch</label>
                  <input
                    id="s-gh-branch"
                    className="input"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    placeholder="main"
                    disabled={saving}
                    autoComplete="off"
                  />
                </div>

                <div className="field">
                  <label htmlFor="s-gh-pat">
                    Personal access token{" "}
                    {hasGithubPat ? (
                      <span className="muted small">(saved — enter a new one to replace)</span>
                    ) : (
                      <span className="muted small">(optional until PR flow ships)</span>
                    )}
                  </label>
                  <input
                    id="s-gh-pat"
                    className="input"
                    type="password"
                    value={githubPat}
                    onChange={(e) => setGithubPat(e.target.value)}
                    placeholder={hasGithubPat ? "Leave empty to keep current token" : "ghp_… or fine-grained token"}
                    disabled={saving}
                    autoComplete="off"
                  />
                </div>

                <h3 className="settings-section-title">Plan → code (FAQ)</h3>
                <p className="muted small settings-faq-intro">
                  CYOA turns feedback into an approved plan first. Getting that plan into real code can happen in more than one way.
                </p>

                <details className="details settings-faq-item">
                  <summary>What does “Generate code and apply” do in this app?</summary>
                  <p className="muted small">
                    After you approve the plan, that flow asks the LLM for a JSON list of files, then{" "}
                    <strong>writes those files on the machine running the API</strong> (your laptop in dev, or your
                    deploy). It does <strong>not</strong> clone GitHub or open a PR by itself. The model only sees your
                    feedback and plan text plus generic project hints—not your full repo unless we add that later.
                  </p>
                </details>

                <details className="details settings-faq-item">
                  <summary>Can I use GitHub instead (issues, PRs, bots)?</summary>
                  <p className="muted small">
                    Yes. A practical pattern is: copy the <strong>approved plan</strong> (and ticket context) into a{" "}
                    <strong>GitHub Issue</strong>, then let your normal toolchain handle implementation—humans, Copilot,
                    or <strong>vendor GitHub integrations</strong> (for example Anthropic’s Claude features for GitHub,
                    if your org has enabled them). Turn those on in{" "}
                    <strong>GitHub → Settings → Integrations / installed GitHub Apps</strong> and follow the vendor’s
                    docs; CYOA does not flip those switches for you.
                  </p>
                </details>

                <details className="details settings-faq-item">
                  <summary>Why save a PAT and default repo here?</summary>
                  <p className="muted small">
                    With those set, an <strong>approved</strong> ticket can use <strong>Create GitHub issue</strong> to
                    open an issue in <code className="inline-code">owner/repo</code> with your plan and original feedback.
                    For PRs and CI, many teams still use <strong>GitHub Actions</strong> with{" "}
                    <code className="inline-code">GITHUB_TOKEN</code> and <strong>auto-merge</strong> when checks pass.
                  </p>
                </details>

                <div className="row">
                  <button type="button" className="btn primary" disabled={saving} onClick={save}>
                    {saving ? "Saving..." : "Save settings"}
                  </button>
                </div>

                {error ? <p className="error">{error}</p> : null}
                {success ? <p className="muted">Settings saved.</p> : null}

                <p className="muted small" style={{ marginTop: "1rem" }}>
                  LLM and GitHub secrets are encrypted with AES-256 (same key material as session cookies via{" "}
                  <code className="inline-code">AUTH_SECRET</code>) and stored in MongoDB. They never leave the server.
                  If a server-level LLM key is set in env, your personal LLM key still takes priority.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
