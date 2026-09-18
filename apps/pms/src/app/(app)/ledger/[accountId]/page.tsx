"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCents, formatLedgerKind } from "@/lib/ledger/format";
import type { LedgerAccountDetail, LedgerExplanationRow } from "@/lib/ledger/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: LedgerAccountDetail };

type CorrectionReply = {
  ok?: boolean;
  code?: string;
  approvalRequestId?: string;
  reasonCode?: string;
  closedMonth?: string | null;
  verb?: string;
  why?: string;
  error?: string;
};

/** A correction is two rows; neither is corrected again, and a charge stands on its procedure. */
function correctable(entry: LedgerExplanationRow): boolean {
  return entry.correctsEntryId === null && entry.kind !== "reversal" && entry.kind !== "charge";
}

/**
 * What a correction row says about itself. The reversal names the entry it
 * clears, the repost names the entry it replaces, and both point at the row
 * the practice can still read, so the ledger stays a history (Increment 1.37).
 */
function correctionLine(entry: LedgerExplanationRow, byId: Map<string, LedgerExplanationRow>): string | null {
  if (!entry.correctsEntryId) return null;
  const original = byId.get(entry.correctsEntryId);
  const on = original ? ` from ${original.effectiveDate}` : "";
  const verb = entry.reversesEntryId ? "Reverses" : "Reposts";
  return `${verb} the ${original ? formatLedgerKind(original.kind).toLowerCase() : "entry"}${on}`;
}

function BalanceStrip({
  label,
  cents,
}: {
  label: string;
  cents: number;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--ink)]">{formatCents(cents)}</p>
    </div>
  );
}

export default function LedgerAccountPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    fetch(`/api/ledger/accounts/${accountId}`)
      .then(async (res) => {
        const body = (await res.json()) as LedgerAccountDetail & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not load this account.");
        if (!cancelled) setState({ status: "ready", detail: body });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Could not load this account.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, reload]);

  function openCorrection(entry: LedgerExplanationRow) {
    setCorrecting(entry.entryId);
    setAmount((entry.amountCents / 100).toFixed(2));
    setReason(entry.reasonCode ?? "");
    setNotice(null);
  }

  async function submitCorrection(entryId: string) {
    const dollars = Number(amount);
    if (!Number.isFinite(dollars)) {
      setNotice("Enter the figure the entry should have carried.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/ledger/correct", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId, amountCents: Math.round(dollars * 100), reasonCode: reason.trim() }),
      });
      const body = (await res.json()) as CorrectionReply;
      if (body.code === "needs_second" && body.approvalRequestId) {
        // Held, not refused: the request is open and the second person releases both halves.
        setCorrecting(null);
        setNotice(`${body.why} (request ${body.approvalRequestId})`);
        return;
      }
      if (!res.ok || !body.ok) {
        setNotice(body.why ?? body.error ?? "The correction was refused.");
        return;
      }
      setCorrecting(null);
      setNotice(
        body.closedMonth
          ? `Corrected. ${body.closedMonth} is closed, so both rows carry reason ${body.reasonCode} and post today.`
          : "Corrected: the entry is reversed and reposted."
      );
      setReload((n) => n + 1);
    } catch {
      setNotice("The correction did not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const byId = new Map(
    state.status === "ready" ? state.detail.entries.map((e) => [e.entryId, e] as const) : []
  );

  const totals =
    state.status === "ready"
      ? state.detail.patients.reduce(
          (sum, patient) => ({
            patientDueCents: sum.patientDueCents + patient.patientDueCents,
            insurancePendingCents: sum.insurancePendingCents + patient.insurancePendingCents,
            creditCents: sum.creditCents + patient.creditCents,
          }),
          { patientDueCents: 0, insurancePendingCents: 0, creditCents: 0 }
        )
      : null;

  return (
    <main>
      <p className="mb-4 text-sm">
        <Link className="font-semibold text-[var(--link)] underline-offset-2 hover:underline" href="/ledger">
          ← Back to ledger
        </Link>
      </p>
      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading account…</p>}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}
      {state.status === "ready" && totals && (
        <>
          <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Explain this balance</p>
          <h1 className="mb-6">{state.detail.displayName}</h1>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <BalanceStrip label="Patient due" cents={totals.patientDueCents} />
            <BalanceStrip label="Insurance pending" cents={totals.insurancePendingCents} />
            <BalanceStrip label="Credit" cents={totals.creditCents} />
          </div>

          <section className="mb-10">
            <h2 className="mb-3 text-lg font-semibold">Patients on this account</h2>
            <ul className="space-y-3">
              {state.detail.patients.map((patient) => (
                <li
                  key={patient.patientId}
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
                >
                  <p className="font-semibold">
                    {patient.lastName}, {patient.firstName}{" "}
                    <span className="text-sm font-normal text-[var(--ink-3)]">({patient.mrn})</span>
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-[var(--ink-2)]">
                    Patient due {formatCents(patient.patientDueCents)} · Insurance pending{" "}
                    {formatCents(patient.insurancePendingCents)} · Credit{" "}
                    {formatCents(patient.creditCents)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Running ledger</h2>
            <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
              A posted entry is never edited. Correcting one writes two rows today — a reversal that clears it and a
              repost carrying the corrected figure — so the ledger reads as the practice&apos;s history.
            </p>
            {notice && <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">{notice}</p>}
            <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Kind</th>
                    <th className="px-4 py-3 font-semibold tabular-nums">Amount</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                    <th className="px-4 py-3 font-semibold">Posted by</th>
                    <th className="px-4 py-3 font-semibold">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {state.detail.entries.map((entry) => {
                    const line = correctionLine(entry, byId);
                    return (
                      <tr key={entry.entryId} className="border-b border-[var(--line)] last:border-0 align-top">
                        <td className="px-4 py-3 tabular-nums">{entry.effectiveDate}</td>
                        <td className="px-4 py-3">
                          {formatLedgerKind(entry.kind)}
                          {line && <span className="block text-xs text-[var(--ink-3)]">{line}</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatCents(entry.amountCents)}</td>
                        <td className="px-4 py-3">
                          {entry.reasonLabel ?? entry.reasonCode ?? entry.memo ?? "—"}
                        </td>
                        <td className="px-4 py-3">{entry.posterName}</td>
                        <td className="px-4 py-3">
                          {correcting === entry.entryId ? (
                            <div className="flex flex-col gap-2">
                              <label className="text-xs font-semibold text-[var(--ink-2)]">
                                Corrected amount
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="mt-1 block w-28 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1 text-sm tabular-nums"
                                  value={amount}
                                  onChange={(e) => setAmount(e.target.value)}
                                />
                              </label>
                              <label className="text-xs font-semibold text-[var(--ink-2)]">
                                Reason
                                <input
                                  type="text"
                                  className="mt-1 block w-36 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1 text-sm"
                                  value={reason}
                                  onChange={(e) => setReason(e.target.value)}
                                />
                              </label>
                              <span className="flex gap-2">
                                <button
                                  type="button"
                                  className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold disabled:opacity-50"
                                  disabled={busy}
                                  onClick={() => void submitCorrection(entry.entryId)}
                                >
                                  {busy ? "Correcting…" : "Reverse and repost"}
                                </button>
                                <button
                                  type="button"
                                  className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-sm font-semibold"
                                  onClick={() => setCorrecting(null)}
                                >
                                  Cancel
                                </button>
                              </span>
                            </div>
                          ) : (
                            correctable(entry) && (
                              <button
                                type="button"
                                className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-sm font-semibold"
                                onClick={() => openCorrection(entry)}
                              >
                                Correct
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
