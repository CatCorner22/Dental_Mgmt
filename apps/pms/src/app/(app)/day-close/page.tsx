"use client";

import { useEffect, useState } from "react";
import { formatCents } from "@/lib/ledger/format";
import type { DayCloseSnapshot, LatePostingRow } from "@/lib/day-close/types";

const DEMO_LOCATION = "0196b0a0-0000-7000-8000-000000000101";
const DEMO_DATE = "2026-09-14";

/**
 * What one late row is, in words (Increment 1.40). A correction announces
 * itself: it names the entry it replaces, and its two halves do different
 * things. A first posting announces nothing, which is exactly why the seal has
 * to.
 */
function lateRowKind(row: LatePostingRow): string {
  if (row.correctsEntryId) {
    return row.kind === "reversal"
      ? "Correction: clears the earlier entry"
      : "Correction: replaces it";
  }
  return `First posting: ${row.kind.replace(/_/g, " ")}`;
}

function lateRowWhen(row: LatePostingRow): string {
  return new Date(row.postedAt).toLocaleString();
}

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
      const body = (await res.json()) as {
        error?: string;
        why?: string;
        otherEligibleNames?: string[];
        created?: number;
        snapshot?: DayCloseSnapshot;
      };
      if (!res.ok) {
        // A seal refusal says why and who could count instead.
        const who = body.otherEligibleNames?.length
          ? ` Who could count instead: ${body.otherEligibleNames.join(", ")}.`
          : "";
        throw new Error((body.why ?? body.error ?? `${label} failed.`) + who);
      }
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
        Location-scoped deposit batch versus imported day-sheet collections. Freezing is the seal
        on the bag: it locks the close atomically, marks deposits closed, and needs a second count
        by someone other than the preparer.
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
              {state.snapshot.status === "frozen" ? (
                <>
                  {/* The glyph repeats the word rather than replacing it, so the state
                      never rests on a symbol alone. */}
                  <span aria-hidden="true">&#128274;</span> Frozen
                </>
              ) : (
                "Open"
              )}
            </span>
            {state.snapshot.frozenByName && (
              <> · frozen by {state.snapshot.frozenByName}</>
            )}
            {state.snapshot.sealStatus === "approved_dual" && <> · second count by a different person</>}
            {state.snapshot.sealStatus === "degraded_owner_seal" && (
              <> · owner-only seal, recorded as a finding</>
            )}
            {state.snapshot.sealStatus === "below_threshold" && <> · one count, under the threshold</>}
            {state.snapshot.sealStatus === "policy_off" && <> · seal recorded, dual release not configured</>}
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

          {state.snapshot.status === "frozen" && (
            <section className="mt-8" aria-labelledby="since-the-seal">
              <h2 id="since-the-seal" className="mb-2 text-lg font-semibold">
                Since the seal
              </h2>
              {state.snapshot.latePostings.length === 0 ? (
                <p className="max-w-prose text-sm text-[var(--ink-2)]">
                  Nothing has posted against this day since it was frozen. The figures above are
                  still the whole of it.
                </p>
              ) : (
                <>
                  <p className="mb-4 max-w-prose text-sm text-[var(--ink-2)]">
                    {state.snapshot.latePostings.length === 1 ? "One row" : `${state.snapshot.latePostings.length} rows`}{" "}
                    posted against this day after it was frozen, together{" "}
                    <span className="font-semibold tabular-nums text-[var(--ink)]">
                      {formatCents(state.snapshot.latePostingTotalCents)}
                    </span>
                    . The sealed figures above do not move, so the day now reads two ways: what the
                    practice counted, and what the ledger holds.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                    <table className="min-w-full text-left text-sm">
                      <caption className="sr-only">
                        Ledger rows posted against this day after it was frozen
                      </caption>
                      <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Posted</th>
                          <th className="px-4 py-3 font-semibold">What</th>
                          <th className="px-4 py-3 font-semibold">Who</th>
                          <th className="px-4 py-3 font-semibold">Reason</th>
                          <th className="px-4 py-3 font-semibold tabular-nums">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.snapshot.latePostings.map((row) => (
                          <tr key={row.entryId} className="border-b border-[var(--line)] last:border-0">
                            <td className="px-4 py-3">{lateRowWhen(row)}</td>
                            <td className="px-4 py-3">{lateRowKind(row)}</td>
                            <td className="px-4 py-3">{row.createdByName}</td>
                            <td className="px-4 py-3">{row.reasonCode ?? "\u2014"}</td>
                            <td className="px-4 py-3 tabular-nums">{formatCents(row.amountCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
