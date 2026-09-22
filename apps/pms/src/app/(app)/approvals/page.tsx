"use client";

import { SessionEnded, loadFailure } from "../session-ended";
import { refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import { useEffect, useState } from "react";
import { formatCents, formatLedgerKind } from "@/lib/ledger/format";

type InboxItem = {
  id: string;
  channel: string;
  kind?: string;
  amountCents: number;
  status: string;
  requesterName: string;
  requestedAt: string;
  subjectId: string | null;
  /** Why the posting was held, in the evaluator's words. */
  why?: string | null;
  /** For an after-hours hold: the clock and the location's window at posting. */
  afterHours?: string | null;
  /** Set when the request holds a correction pair rather than one posting (Increment 1.39). */
  correction?: {
    correctsEntryId: string;
    repostKind: string;
    /** What the entry being corrected carries now. */
    fromCents: number;
    /** What the correction proposes it should carry. */
    toCents: number;
  } | null;
};

type LoadState =
  | { status: "loading" }
  /** The sign-in behind this screen has ended (Increment 1.82). */
  | { status: "sign_in_ended" }
  | { status: "error"; message: string }
  | { status: "ready"; items: InboxItem[] };

export default function ApprovalsPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [declineReason, setDeclineReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadInbox() {
    const res = await fetch("/api/approvals/inbox");
    const body = (await res.json()) as { items?: InboxItem[]; error?: string };
    refuseIfSignInEnded(res);
    if (!res.ok) throw new Error(body.error ?? "Could not load approvals inbox.");
    return body.items ?? [];
  }

  useEffect(() => {
    let cancelled = false;
    loadInbox()
      .then((items) => {
        if (!cancelled) setState({ status: "ready", items });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState(loadFailure(err, "Could not load approvals inbox."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(id: string, decision: "approved" | "declined") {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/approvals/${id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          reason: decision === "declined" ? declineReason : undefined,
        }),
      });
      const body = (await res.json()) as { error?: string; status?: string };
      refuseIfSignInEnded(res);
      if (!res.ok) throw new Error(body.error ?? "Decision failed.");
      const items = await loadInbox();
      setState({ status: "ready", items });
      setMessage(`Request ${decision}.`);
      setDeclineReason("");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Decision failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Money Desk</p>
      <h1 className="mb-2">Approvals inbox</h1>
      <p className="mb-8 max-w-prose text-[var(--ink-2)]">
        Pending dual-release requests you can approve. The requester never sees their own item here. A correction
        holds both of its rows together: approving writes the pair, declining writes neither.
      </p>

      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading inbox…</p>}
      {state.status === "sign_in_ended" && <SessionEnded />}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}
      {message && <p className="mb-4 text-sm text-[var(--ink-2)]">{message}</p>}

      {state.status === "ready" && state.items.length === 0 && (
        <p className="text-sm text-[var(--ink-2)]">No pending approvals.</p>
      )}

      {state.status === "ready" && state.items.length > 0 && (
        <div className="space-y-4">
          {state.items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold capitalize">
                  {item.correction ? "Correction" : item.channel.replace(/_/g, " ")}
                </h2>
                <p className="text-lg font-semibold tabular-nums">{formatCents(item.amountCents)}</p>
              </div>
              <p className="mb-1 text-sm text-[var(--ink-2)]">
                Requested by {item.requesterName} · {new Date(item.requestedAt).toLocaleString()}
                {item.kind ? ` · ${item.kind.replace(/_/g, " ")}` : ""}
              </p>
              {item.correction && (
                <p className="mb-1 max-w-prose text-sm text-[var(--ink-2)]">
                  <span className="font-semibold">What changes:</span> the{" "}
                  {formatLedgerKind(item.correction.repostKind).toLowerCase()} carries{" "}
                  <span className="tabular-nums">{formatCents(item.correction.fromCents)}</span> and would carry{" "}
                  <span className="tabular-nums">{formatCents(item.correction.toCents)}</span>. Approving writes both
                  rows, the reversal that clears it and the repost that replaces it, in one transaction. Declining
                  writes neither.
                </p>
              )}
              {(item.why || item.afterHours) && (
                <p className="mb-4 max-w-prose text-sm text-[var(--ink-2)]">
                  <span className="font-semibold">Why held:</span> {item.why}
                  {item.afterHours ? ` ${item.afterHours}` : ""}
                </p>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item.id, "approved")}
                >
                  Approve
                </button>
                <label className="flex min-w-[12rem] flex-1 flex-col text-sm">
                  <span className="mb-1 font-semibold text-[var(--ink-2)]">Decline reason</span>
                  <input
                    className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Required to decline"
                  />
                </label>
                <button
                  type="button"
                  className="rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled={busyId === item.id || !declineReason.trim()}
                  onClick={() => void decide(item.id, "declined")}
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
