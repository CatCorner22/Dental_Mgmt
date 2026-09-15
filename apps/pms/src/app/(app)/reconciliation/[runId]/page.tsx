"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCents } from "@/lib/ledger/format";
import type { ReconciliationRunDetail } from "@/lib/reconciliation/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; run: ReconciliationRunDetail };

function varianceLabel(kind: string): string {
  switch (kind) {
    case "unmatched_bank":
      return "Unmatched bank line";
    case "matched_deposit":
      return "Matched deposit slip";
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

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reconciliation/runs/${runId}`)
      .then(async (res) => {
        const body = (await res.json()) as { run?: ReconciliationRunDetail; error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not load reconciliation run.");
        if (!cancelled && body.run) setState({ status: "ready", run: body.run });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Could not load reconciliation run.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Money Desk</p>
      <div className="mb-6">
        <Link className="text-sm text-[var(--link)] underline-offset-2 hover:underline" href="/reconciliation">
          ← All runs
        </Link>
      </div>

      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading run…</p>}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}
      {state.status === "ready" && (
        <>
          <h1 className="mb-2">
            {state.run.periodStart} → {state.run.periodEnd}
          </h1>
          <p className="mb-6 max-w-prose text-[var(--ink-2)]">
            {state.run.bankAccountName} · Source: statement import · Opened by {state.run.createdByName}
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
