"use client";

import { useEffect, useState } from "react";
import { formatCents } from "@/lib/ledger/format";
import type { DayCloseSnapshot } from "@/lib/day-close/types";

const DEMO_LOCATION = "0196b0a0-0000-7000-8000-000000000101";
const DEMO_DATE = "2026-09-14";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: DayCloseSnapshot };

export default function DayClosePage() {
  const [businessDate, setBusinessDate] = useState(DEMO_DATE);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadSnapshot() {
    const res = await fetch(
      `/api/day-close?locationId=${DEMO_LOCATION}&businessDate=${businessDate}`
    );
    const body = (await res.json()) as { snapshot?: DayCloseSnapshot; error?: string };
    if (!res.ok) throw new Error(body.error ?? "Could not load day close.");
    if (!body.snapshot) throw new Error("Missing snapshot.");
    return body.snapshot;
  }

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadSnapshot()
      .then((snapshot) => {
        if (!cancelled) setState({ status: "ready", snapshot });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Could not load day close.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [businessDate]);

  async function runAction(path: string, label: string) {
    setBusy(true);
    setActionMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId: DEMO_LOCATION, businessDate }),
      });
      const body = (await res.json()) as { error?: string; created?: number; snapshot?: DayCloseSnapshot };
      if (!res.ok) throw new Error(body.error ?? `${label} failed.`);
      if (body.snapshot) setState({ status: "ready", snapshot: body.snapshot });
      else {
        const snapshot = await loadSnapshot();
        setState({ status: "ready", snapshot });
      }
      setActionMessage(
        body.created !== undefined ? `Applied ${body.created} staged deposit(s).` : `${label} succeeded.`
      );
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Money Desk</p>
      <h1 className="mb-2">Day close</h1>
      <p className="mb-8 max-w-prose text-[var(--ink-2)]">
        Location-scoped deposit batch versus imported day-sheet collections. Freezing locks the
        close atomically and marks deposits closed.
      </p>

      <label className="mb-6 block max-w-xs text-sm">
        <span className="mb-1 block font-semibold text-[var(--ink-2)]">Business date</span>
        <input
          className="w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
          type="date"
          value={businessDate}
          onChange={(e) => setBusinessDate(e.target.value)}
        />
      </label>

      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading…</p>}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}
      {state.status === "ready" && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Deposit batch
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatCents(state.snapshot.depositTotalCents)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Day sheet payments
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatCents(state.snapshot.daySheetTotalCents)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Variance
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatCents(state.snapshot.varianceCents)}
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm text-[var(--ink-2)]">
            Status:{" "}
            <span className="font-semibold text-[var(--ink)]">
              {state.snapshot.status === "frozen" ? "Frozen" : "Open"}
            </span>
            {state.snapshot.frozenByName && (
              <> · frozen by {state.snapshot.frozenByName}</>
            )}
          </p>

          <div className="mb-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={busy || state.snapshot.status === "frozen"}
              onClick={() => void runAction("/api/deposits/apply-staged", "Apply staged deposits")}
            >
              Apply staged deposits
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={busy || state.snapshot.status === "frozen" || state.snapshot.deposits.length === 0}
              onClick={() => void runAction("/api/day-close/freeze", "Freeze day close")}
            >
              Freeze day close
            </button>
          </div>
          {actionMessage && <p className="mb-6 text-sm text-[var(--ink-2)]">{actionMessage}</p>}

          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Prepared by</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold tabular-nums">Amount</th>
                </tr>
              </thead>
              <tbody>
                {state.snapshot.deposits.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-[var(--ink-2)]" colSpan={5}>
                      No deposits for this date yet.
                    </td>
                  </tr>
                )}
                {state.snapshot.deposits.map((deposit) => (
                  <tr key={deposit.depositId} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3">{deposit.method}</td>
                    <td className="px-4 py-3">{deposit.reference ?? "—"}</td>
                    <td className="px-4 py-3">{deposit.preparedByName}</td>
                    <td className="px-4 py-3">{deposit.status}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCents(deposit.amountCents)}</td>
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
