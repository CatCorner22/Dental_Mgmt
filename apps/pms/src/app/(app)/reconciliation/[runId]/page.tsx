"use client";

import { SessionEnded, loadFailure } from "../../session-ended";
import { isSignInEnded, refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCents } from "@/lib/ledger/format";
import {
  independenceSourceLabel,
  type ReconciliationRunDetail,
} from "@/lib/reconciliation/types";

type LoadState =
  | { status: "loading" }
  /** The sign-in behind this screen has ended (Increment 1.82). */
  | { status: "sign_in_ended" }
  | { status: "error"; message: string }
  | { status: "ready"; run: ReconciliationRunDetail };

function varianceLabel(kind: string): string {
  switch (kind) {
    case "unmatched_bank":
      return "Unmatched bank line";
    case "matched_deposit":
      return "Matched deposit";
    case "unmatched_ledger":
      return "Unmatched ledger";
    case "amount_mismatch":
      return "Amount mismatch";
    default:
      return kind.replace(/_/g, " ");
  }
}

export default function ReconciliationRunPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRun(): Promise<ReconciliationRunDetail> {
    const res = await fetch(`/api/reconciliation/runs/${runId}`);
    const body = (await res.json()) as { run?: ReconciliationRunDetail; error?: string };
    refuseIfSignInEnded(res);
    if (!res.ok) throw new Error(body.error ?? "Could not load reconciliation run.");
    if (!body.run) throw new Error("Missing reconciliation run.");
    return body.run;
  }

  useEffect(() => {
    let cancelled = false;
    loadRun()
      .then((run) => {
        if (!cancelled) setState({ status: "ready", run });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState(loadFailure(err, "Could not load reconciliation run."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function handleClear() {
    setBusy(true);
    setMessage(null);
    try {
      // Every guarded write needs a JSON content type; a bare POST is refused with 415.
      const res = await fetch(`/api/reconciliation/runs/${runId}/clear`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await res.json()) as {
        run?: ReconciliationRunDetail;
        error?: string;
        verb?: string;
        why?: string;
      };
      if (!res.ok) {
        throw new Error(body.verb ?? body.error ?? "Could not clear this run.");
      }
      if (body.run) setState({ status: "ready", run: body.run });
      setMessage(
        body.run?.degradedOwnerClearance
          ? "Cleared. Owner-only clearance was recorded as a finding."
          : "Variances cleared."
      );
    } catch (err: unknown) {
      // The sign-in is over, so nothing this screen offers can succeed (Increment 1.83).
      if (isSignInEnded(err)) {
        setState({ status: "sign_in_ended" });
        return;
      }
      setMessage(err instanceof Error ? err.message : "Could not clear this run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Money Desk</p>
      <div className="mb-6">
        <Link className="text-sm text-[var(--link)] underline-offset-2 hover:underline" href="/reconciliation">
          ← All runs
        </Link>
      </div>

      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading run…</p>}
      {state.status === "sign_in_ended" && <SessionEnded />}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}
      {state.status === "ready" && (
        <>
          <h1 className="mb-2">
            {state.run.periodStart} → {state.run.periodEnd}
          </h1>
          <p className="mb-2 max-w-prose text-[var(--ink-2)]">
            {state.run.bankAccountName} · Opened by {state.run.createdByName}
          </p>
          <p className="mb-6 text-sm font-semibold text-[var(--ink-2)]">
            Independence source: {independenceSourceLabel(state.run.source)}
          </p>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Bank net</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatCents(state.run.bankNetCents)}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Matched</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatCents(state.run.matchedCents)}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Open variances</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{state.run.openVarianceCount}</p>
            </div>
          </div>

          {state.run.status === "cleared" && (
            <div className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="font-semibold">Cleared</p>
              <p className="mt-1 text-sm text-[var(--ink-2)]">
                {state.run.clearedByName ?? "Unknown"}
                {state.run.clearedAt ? ` · ${new Date(state.run.clearedAt).toLocaleString()}` : ""}
              </p>
              {state.run.degradedOwnerClearance && (
                <p className="mt-2 text-sm text-[var(--ink-2)]">
                  Finding: owner-only clearance — no other eligible person existed. The control was
                  not disabled.
                </p>
              )}
            </div>
          )}

          {state.run.status !== "cleared" && state.run.clearance?.ok && (
            <div className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="mb-2 text-sm text-[var(--ink-2)]">{state.run.clearance.why}</p>
              <button
                type="button"
                className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={busy}
                onClick={() => void handleClear()}
              >
                {busy ? "Clearing…" : state.run.clearance.verb}
              </button>
            </div>
          )}

          {state.run.status !== "cleared" && state.run.clearance && !state.run.clearance.ok && (
            <div className="mb-6 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-4">
              <p className="font-semibold">{state.run.clearance.verb}</p>
              <p className="mt-1 text-sm text-[var(--ink-2)]">{state.run.clearance.why}</p>
            </div>
          )}

          {message && (
            <p className="mb-6 text-sm text-[var(--ink-2)]" aria-live="polite">
              {message}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold tabular-nums">Amount</th>
                </tr>
              </thead>
              <tbody>
                {state.run.variances.map((row) => (
                  <tr key={row.varianceId} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3 tabular-nums">{row.postedDate ?? "—"}</td>
                    <td className="px-4 py-3">{varianceLabel(row.kind)}</td>
                    <td className="px-4 py-3">{row.description}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCents(row.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
