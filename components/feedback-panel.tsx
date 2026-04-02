"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function apiError(body: unknown, fallback: string): string {
  const b = body as { error?: string; missing?: string[] } | null;
  if (!b?.error) return fallback;
  if (b.missing?.length) return `${b.error}: ${b.missing.join(", ")}`;
  return b.error;
}

type AiOutput = {
  refused?: boolean;
  summary?: string;
  proposedSteps?: string[];
  risks?: string[];
  outOfScope?: string[];
  doNotDo?: string[];
};

export type FeedbackItem = {
  _id: string;
  title?: string;
  kind?: "feature" | "bug" | "other";
  text: string;
  contextWhere?: string;
  contextPage?: string;
  contextSteps?: string;
  status: string;
  source: string;
  createdAt?: string;
  aiOutput?: AiOutput;
  aiRaw?: string;
  approvedPlan?: string[];
  codeOutput?: string;
  applyResult?: string;
  appliedAt?: string;
  errorMessage?: string;
};

export function FeedbackPanel({ initialItems }: { initialItems: FeedbackItem[] }) {
  const [items, setItems] = useState<FeedbackItem[]>(initialItems);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"feature" | "bug" | "other">("other");
  const [text, setText] = useState("");
  const [contextWhere, setContextWhere] = useState("");
  const [contextPage, setContextPage] = useState("");
  const [contextSteps, setContextSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) return;
      const data = (await res.json()) as { items: FeedbackItem[] };
      setItems(data.items);
    } catch { /* auth or network errors are non-fatal here */ }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: title.trim() || undefined,
          kind,
          contextWhere: contextWhere.trim() || undefined,
          contextPage: contextPage.trim() || undefined,
          contextSteps: contextSteps.trim() || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(apiError(await res.json().catch(() => null), "Submit failed"));
      }
      const { id } = (await res.json()) as { id: string };
      setTitle("");
      setKind("other");
      setText("");
      setContextWhere("");
      setContextPage("");
      setContextSteps("");
      const proc = await fetch(`/api/feedback/${id}/process`, { method: "POST" });
      if (!proc.ok) {
        throw new Error(apiError(await proc.json().catch(() => null), "Processing failed"));
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [text, title, kind, contextWhere, contextPage, contextSteps, refresh]);

  return (
    <div className="feedback">
      <section className="card">
        <h2>New feedback</h2>
        <p className="muted">
          One message per ticket: ship a feature slice, or report what broke while using the product. Analysis
          overwrites previous LLM output if you re-analyze the same id.
        </p>
        <div className="field">
          <label htmlFor="fb-title">Title (optional)</label>
          <input
            id="fb-title"
            className="input"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short label for the list"
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="fb-kind">Intent</label>
          <select
            id="fb-kind"
            className="select"
            value={kind}
            onChange={(e) => setKind(e.target.value as "feature" | "bug" | "other")}
            disabled={busy}
          >
            <option value="feature">Feature / change</option>
            <option value="bug">Bug / broken behavior</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="fb-text">Details</label>
          <textarea
            id="fb-text"
            className="textarea"
            rows={5}
            maxLength={8000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What you want built or what went wrong…"
            disabled={busy}
          />
        </div>
        <details className="details">
          <summary>Using the product? Add context (optional)</summary>
          <div className="field">
            <label htmlFor="fb-where">Where / environment</label>
            <textarea
              id="fb-where"
              className="textarea small-ta"
              rows={2}
              maxLength={2000}
              value={contextWhere}
              onChange={(e) => setContextWhere(e.target.value)}
              placeholder="e.g. staging, Chrome, Windows…"
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="fb-page">Screen or page</label>
            <input
              id="fb-page"
              className="input"
              maxLength={500}
              value={contextPage}
              onChange={(e) => setContextPage(e.target.value)}
              placeholder="e.g. Settings → Billing"
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="fb-steps">Steps to reproduce</label>
            <textarea
              id="fb-steps"
              className="textarea"
              rows={3}
              maxLength={4000}
              value={contextSteps}
              onChange={(e) => setContextSteps(e.target.value)}
              placeholder="1. … 2. …"
              disabled={busy}
            />
          </div>
        </details>
        <div className="row">
          <button type="button" className="btn primary" disabled={busy || !text.trim()} onClick={submit}>
            {busy ? "Working…" : "Submit and analyze"}
          </button>
          <span className="muted">{text.length}/8000</span>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card">
        <h2>Your feedback</h2>
        {items.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="list">
            {items.map((item) => (
              <li key={item._id} className="list-item">
                <div className="list-head">
                  <span className={`pill status-${item.status}`}>{item.status}</span>
                  <span className={`pill kind-${item.kind ?? "other"}`}>{item.kind ?? "other"}</span>
                  <span className="muted small">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
                  </span>
                </div>
                <TitleRow item={item} disabled={busy} onSaved={refresh} />
                {item.contextWhere || item.contextPage || item.contextSteps ? (
                  <div className="context-block muted small">
                    {item.contextWhere ? (
                      <p>
                        <strong>Where:</strong> {item.contextWhere}
                      </p>
                    ) : null}
                    {item.contextPage ? (
                      <p>
                        <strong>Page:</strong> {item.contextPage}
                      </p>
                    ) : null}
                    {item.contextSteps ? (
                      <p>
                        <strong>Steps:</strong> {item.contextSteps}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <p className="feedback-text">{item.text}</p>
                {item.errorMessage ? <p className="error">{item.errorMessage}</p> : null}
                {item.aiOutput ? (
                  <div className="ai">
                    <p>
                      <strong>Summary:</strong> {item.aiOutput.summary}
                    </p>
                    {item.aiOutput.refused ? <p className="warn">Refused by policy guidance.</p> : null}
                    <AiList title="Proposed steps" items={item.aiOutput.proposedSteps} />
                    <AiList title="Risks" items={item.aiOutput.risks} />
                    <AiList title="Out of scope (needs human)" items={item.aiOutput.outOfScope} />
                    <AiList title="Do not do (agent guardrails)" items={item.aiOutput.doNotDo} />
                  </div>
                ) : null}
                <PlanActions
                  item={item}
                  busy={busy}
                  onAction={async (action) => {
                    setError(null);
                    setBusy(true);
                    try {
                      if (action.type === "reprocess") {
                        const proc = await fetch(`/api/feedback/${item._id}/process`, { method: "POST" });
                        if (!proc.ok) {
                          throw new Error(apiError(await proc.json().catch(() => null), "Processing failed"));
                        }
                      } else if (action.type === "accept") {
                        const res = await fetch(`/api/feedback/${item._id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "accept", editedSteps: action.steps }),
                        });
                        if (!res.ok) {
                          throw new Error(apiError(await res.json().catch(() => null), "Accept failed"));
                        }
                      } else if (action.type === "reject") {
                        const res = await fetch(`/api/feedback/${item._id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "reject" }),
                        });
                        if (!res.ok) throw new Error("Reject failed");
                      } else if (action.type === "apply") {
                        const res = await fetch(`/api/feedback/${item._id}/apply`, { method: "POST" });
                        if (!res.ok) {
                          throw new Error(apiError(await res.json().catch(() => null), "Apply failed"));
                        }
                        const data = await res.json() as { verification?: { passed: boolean; output: string } };
                        if (data.verification && !data.verification.passed) {
                          setError(`Applied but verification failed:\n${data.verification.output.slice(0, 500)}`);
                        }
                      }
                      await refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Something went wrong");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <OperatorBlock item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type PlanAction =
  | { type: "reprocess" }
  | { type: "accept"; steps: string[] }
  | { type: "reject" }
  | { type: "apply" };

function PlanActions({
  item,
  busy,
  onAction,
}: {
  item: FeedbackItem;
  busy: boolean;
  onAction: (action: PlanAction) => Promise<void>;
}) {
  const steps = item.aiOutput?.proposedSteps ?? [];
  const [editableSteps, setEditableSteps] = useState<string[]>(steps);
  const [editing, setEditing] = useState(false);

  if (item.status === "processing" || item.status === "applying") {
    return <p className="muted small">Working...</p>;
  }

  if (item.status === "applied") {
    return (
      <div className="plan-actions">
        <p className="muted small">Applied {item.appliedAt ? new Date(item.appliedAt).toLocaleString() : ""}</p>
        {item.applyResult ? (
          <pre className="raw-pre">{item.applyResult}</pre>
        ) : null}
        <button type="button" className="btn ghost" disabled={busy} onClick={() => onAction({ type: "reprocess" })}>
          Start over (re-analyze)
        </button>
      </div>
    );
  }

  if (item.status === "approved" && item.approvedPlan?.length) {
    return (
      <div className="plan-actions">
        <p className="muted small">Plan approved — ready to generate code and apply.</p>
        <div className="row">
          <button type="button" className="btn primary" disabled={busy} onClick={() => onAction({ type: "apply" })}>
            Generate code and apply
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => onAction({ type: "reject" })}>
            Reject plan
          </button>
        </div>
      </div>
    );
  }

  if ((item.status === "done" || item.status === "error") && steps.length > 0 && !item.aiOutput?.refused) {
    return (
      <div className="plan-actions">
        {editing ? (
          <div className="editable-steps">
            <p className="muted small">Edit, reorder, or remove steps before accepting:</p>
            {editableSteps.map((step, i) => (
              <div key={i} className="step-row">
                <span className="step-num">{i + 1}.</span>
                <input
                  className="input step-input"
                  value={step}
                  onChange={(e) => {
                    const next = [...editableSteps];
                    next[i] = e.target.value;
                    setEditableSteps(next);
                  }}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => setEditableSteps(editableSteps.filter((_, j) => j !== i))}
                  title="Remove step"
                >
                  x
                </button>
              </div>
            ))}
            <div className="row">
              <button
                type="button"
                className="btn primary"
                disabled={busy || editableSteps.filter((s) => s.trim()).length === 0}
                onClick={() => onAction({ type: "accept", steps: editableSteps.filter((s) => s.trim()) })}
              >
                Accept plan
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="row">
            <button type="button" className="btn primary" disabled={busy} onClick={() => onAction({ type: "accept", steps })}>
              Accept plan
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => { setEditableSteps(steps); setEditing(true); }}>
              Edit plan
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => onAction({ type: "reprocess" })}>
              Re-analyze
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button type="button" className="btn ghost" disabled={busy} onClick={() => onAction({ type: "reprocess" })}>
      {item.status === "pending" ? "Run analysis" : "Re-analyze"}
    </button>
  );
}

function TitleRow({
  item,
  disabled,
  onSaved,
}: {
  item: FeedbackItem;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(item.title ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(item.title ?? "");
  }, [item.title, item._id]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/feedback/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
      if (!res.ok) throw new Error("Could not save title");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }, [item._id, value, onSaved]);

  return (
    <div className="title-row">
      <input
        className="input title-input"
        maxLength={200}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Title (save separately)"
        disabled={disabled || saving}
      />
      <button type="button" className="btn ghost" disabled={disabled || saving} onClick={save}>
        {saving ? "Saving…" : "Save title"}
      </button>
    </div>
  );
}

function OperatorBlock({ item }: { item: FeedbackItem }) {
  const [copied, setCopied] = useState(false);
  const payload = useMemo(
    () => ({
      feedbackId: item._id,
      title: item.title ?? "",
      kind: item.kind ?? "other",
      text: item.text,
      context: {
        where: item.contextWhere ?? "",
        page: item.contextPage ?? "",
        stepsToReproduce: item.contextSteps ?? "",
      },
      aiOutput: item.aiOutput ?? null,
      aiRaw: item.aiRaw ?? null,
    }),
    [item],
  );
  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [json]);

  return (
    <details className="details operator">
      <summary>Raw / copy for agent</summary>
      <p className="muted small">
        JSON bundle for pasting into Cursor, a ticket, or a downstream builder. Includes structured{" "}
        <code>aiOutput</code> and raw <code>aiRaw</code> when present.
      </p>
      <button type="button" className="btn ghost copy-btn" onClick={copy}>
        {copied ? "Copied" : "Copy JSON"}
      </button>
      <pre className="raw-pre" tabIndex={0}>
        {json}
      </pre>
    </details>
  );
}

function AiList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="ai-block">
      <strong>{title}</strong>
      <ul>
        {items.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
