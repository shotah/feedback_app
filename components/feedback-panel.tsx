"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Submit failed");
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
        const body = await proc.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Processing failed");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [text, title, kind, contextWhere, contextPage, contextSteps, refresh]);

  const reprocess = useCallback(
    async (id: string) => {
      setError(null);
      setBusy(true);
      try {
        const proc = await fetch(`/api/feedback/${id}/process`, { method: "POST" });
        if (!proc.ok) {
          const body = await proc.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? "Processing failed");
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

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
                <OperatorBlock item={item} />
                {item.status !== "processing" ? (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => reprocess(item._id)}
                  >
                    {item.status === "pending"
                      ? "Run analysis"
                      : item.status === "done"
                        ? "Re-analyze (overwrites)"
                        : "Retry analysis"}
                  </button>
                ) : (
                  <p className="muted small">Analyzing…</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
