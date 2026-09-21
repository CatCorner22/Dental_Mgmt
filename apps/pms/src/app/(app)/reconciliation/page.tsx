"use client";

import { SessionEnded, loadFailure } from "../session-ended";
import { refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MatchingMeasurementSummary, ReconciliationMeasurementSummary } from "@pms/controls-engine";
import { formatCents } from "@/lib/ledger/format";
import {
  independenceSourceLabel,
  type BankAccountOption,
  type ReconciliationRunSummary,
} from "@/lib/reconciliation/types";

type Measurements = {
  reconciliation?: ReconciliationMeasurementSummary;
  matching?: MatchingMeasurementSummary;
};

type LoadState =
  | { status: "loading" }
  /** The sign-in behind this screen has ended (Increment 1.82). */
  | { status: "sign_in_ended" }
  | { status: "error"; message: string }
  | { status: "ready"; runs: ReconciliationRunSummary[]; accounts: BankAccountOption[]; measurements: Measurements };

function gradeLabel(grade: ReconciliationMeasurementSummary["grade"]): string {
  return grade === "independent" ? "Independent" : grade === "same_hands" ? "Same hands" : "Stale import";
}

function lagLabel(days: number | null): string {
  if (days === null) return "no lines yet";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "matched":
      return "Matched";
    case "variance":
      return "Variance";
    case "cleared":
      return "Cleared";
    default:
      return status.replace(/_/g, " ");
  }
}

export default function ReconciliationPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [bankAccountId, setBankAccountId] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function loadRuns() {
    const [runsRes, accountsRes] = await Promise.all([
      fetch("/api/reconciliation/runs"),
      fetch("/api/bank/accounts"),
    ]);
    const runsBody = (await runsRes.json()) as {
      runs?: ReconciliationRunSummary[];
      measurements?: Measurements;
      error?: string;
    };
    const accountsBody = (await accountsRes.json()) as { accounts?: BankAccountOption[]; error?: string };
    refuseIfSignInEnded(runsRes);
    if (!runsRes.ok) throw new Error(runsBody.error ?? "Could not load reconciliation runs.");
    refuseIfSignInEnded(accountsRes);
    if (!accountsRes.ok) throw new Error(accountsBody.error ?? "Could not load bank accounts.");
    return {
      runs: runsBody.runs ?? [],
      accounts: accountsBody.accounts ?? [],
      measurements: runsBody.measurements ?? {},
    };
  }

  useEffect(() => {
    let cancelled = false;
    loadRuns()
      .then((data) => {
        if (!cancelled) {
          setState({ status: "ready", ...data });
          setBankAccountId((current) => current || data.accounts[0]?.bankAccountId || "");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState(loadFailure(err, "Could not load reconciliation."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleImport() {
    if (!bankAccountId || !csvContent.trim()) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const res = await fetch("/api/import/bank-statement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bankAccountId,
          content: csvContent,
          fileName: "statement.csv",
        }),
      });
      const body = (await res.json()) as {
        reconciliationRunId?: string;
        error?: string;
        unmatchedCount?: number;
        matchedDepositCount?: number;
      };
      refuseIfSignInEnded(res);
      if (!res.ok) throw new Error(body.error ?? "Import failed.");
      setImportMessage(
        `Imported statement. ${body.matchedDepositCount ?? 0} deposit(s) matched, ${body.unmatchedCount ?? 0} open variance(s).`
      );
      setCsvContent("");
      const data = await loadRuns();
      setState({ status: "ready", ...data });
      if (body.reconciliationRunId) {
        window.location.href = `/reconciliation/${body.reconciliationRunId}`;
      }
    } catch (err: unknown) {
      setImportMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Money Desk</p>
      <h1 className="mb-2">Bank reconciliation</h1>
      <p className="mb-6 max-w-prose text-[var(--ink-2)]">
        Independent ground truth from statement import. Each run opens a variance queue; a bank credit
        matches when the practice prepared a deposit, or staged a Curve Hero deposit slip, for the same
        date and amount.
      </p>

      {state.status === "ready" && (state.measurements.reconciliation || state.measurements.matching) && (
        <section aria-labelledby="measured" className="mb-8 grid gap-4 md:grid-cols-2">
          <h2 id="measured" className="sr-only">
            Measured from these runs
          </h2>
          {state.measurements.reconciliation && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Independent reconciliation · last {state.measurements.reconciliation.windowDays} days
              </p>
              <p className="mt-1 text-xl font-semibold">{gradeLabel(state.measurements.reconciliation.grade)}</p>
              <p className="mt-1 text-sm text-[var(--ink-2)]">{state.measurements.reconciliation.why}</p>
            </div>
          )}
          {state.measurements.matching && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Bank matching · last {state.measurements.matching.windowDays} days
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {state.measurements.matching.matchRate48hPct === null
                  ? "No rate yet"
                  : `${state.measurements.matching.matchRate48hPct}% within 48 hours`}
                <span className="text-base font-normal text-[var(--ink-2)]">
                  {" "}· median lag {lagLabel(state.measurements.matching.medianLagDays)}
                </span>
              </p>
              <p className="mt-1 text-sm text-[var(--ink-2)]">{state.measurements.matching.why}</p>
            </div>
          )}
        </section>
      )}

      {state.status === "ready" && state.accounts.length > 0 && (
        <section className="mb-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
          <h2 className="mb-3 text-lg font-semibold">Import bank statement (CSV)</h2>
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-[var(--ink-2)]">Bank account</span>
              <select
                className="w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                {state.accounts.map((account) => (
                  <option key={account.bankAccountId} value={account.bankAccountId}>
                    {account.displayName}
                    {account.accountNumberLast4 ? ` ····${account.accountNumberLast4}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block font-semibold text-[var(--ink-2)]">CSV content</span>
            <textarea
              className="min-h-32 w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-xs"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Date,Description,Amount"
            />
          </label>
          <button
            type="button"
            className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={importing || !csvContent.trim()}
            onClick={() => void handleImport()}
          >
            {importing ? "Importing…" : "Import statement"}
          </button>
          {importMessage && <p className="mt-3 text-sm text-[var(--ink-2)]">{importMessage}</p>}
        </section>
      )}

      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading runs…</p>}
      {state.status === "sign_in_ended" && <SessionEnded />}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}
      {state.status === "ready" && state.runs.length === 0 && (
        <p className="text-sm text-[var(--ink-2)]">No reconciliation runs yet. Import a statement to start.</p>
      )}
      {state.status === "ready" && state.runs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold tabular-nums">Net</th>
                <th className="px-4 py-3 font-semibold tabular-nums">Open</th>
              </tr>
            </thead>
            <tbody>
              {state.runs.map((run) => (
                <tr key={run.runId} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-[var(--link)] underline-offset-2 hover:underline"
                      href={`/reconciliation/${run.runId}`}
                    >
                      {run.periodStart} → {run.periodEnd}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{run.bankAccountName}</td>
                  <td className="px-4 py-3">{independenceSourceLabel(run.source)}</td>
                  <td className="px-4 py-3">{statusLabel(run.status)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCents(run.bankNetCents)}</td>
                  <td className="px-4 py-3 tabular-nums">{run.openVarianceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
