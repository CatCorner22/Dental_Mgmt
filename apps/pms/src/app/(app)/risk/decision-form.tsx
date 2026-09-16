"use client";

import { useState } from "react";
import { DECISION_KINDS, DECISION_KIND_LABEL, type DecisionKind } from "@pms/controls-engine";

export type DecisionDraft = { kind: DecisionKind; note: string; reviewBy: string };

/**
 * One decision, typed once. The note must say why (at least ten characters);
 * a review date is the day the decision is looked at again. The server is the
 * judge of both; this form only keeps the obvious mistakes from a round trip.
 */
export function DecisionForm({
  kinds = DECISION_KINDS,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  kinds?: readonly DecisionKind[];
  submitLabel: string;
  busy: boolean;
  onSubmit: (draft: DecisionDraft) => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<DecisionKind>(kinds[0] ?? "accept_residual");
  const [note, setNote] = useState("");
  const [reviewBy, setReviewBy] = useState("");
  const noteOk = note.trim().length >= 10;

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!noteOk) return;
        onSubmit({ kind, note: note.trim(), reviewBy });
      }}
    >
      <label className="flex flex-col text-sm">
        <span className="mb-1 font-semibold text-[var(--ink-2)]">Decision</span>
        <select
          className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
          value={kind}
          onChange={(e) => setKind(e.target.value as DecisionKind)}
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {DECISION_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[16rem] flex-1 flex-col text-sm">
        <span className="mb-1 font-semibold text-[var(--ink-2)]">Why (at least ten characters)</span>
        <input
          className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What compensates for this, or why the residual risk is acceptable"
        />
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 font-semibold text-[var(--ink-2)]">Review by</span>
        <input
          className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
          type="date"
          value={reviewBy}
          onChange={(e) => setReviewBy(e.target.value)}
        />
      </label>
      <button
        type="submit"
        className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        disabled={busy || !noteOk}
      >
        {busy ? "Recording…" : submitLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </form>
  );
}
