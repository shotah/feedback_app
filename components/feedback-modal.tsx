"use client";

import { useCallback, useEffect, useState } from "react";
import { FeedbackPanel } from "./feedback-panel";

export function FeedbackModal() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    <>
      <div className="feedback-fab">
        <button
          type="button"
          className="btn primary feedback-fab-btn"
          onClick={() => setOpen(true)}
          aria-label="Open feedback"
        >
          Feedback
        </button>
      </div>

      {open ? (
        <div className="modal-backdrop" onClick={close}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Feedback</h2>
              <button
                type="button"
                className="btn ghost modal-close"
                onClick={close}
              >
                Close
              </button>
            </div>
            <FeedbackPanel initialItems={[]} />
          </div>
        </div>
      ) : null}
    </>
  );
}
