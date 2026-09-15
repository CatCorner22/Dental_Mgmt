"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCents, formatLedgerKind } from "@/lib/ledger/format";
import type { LedgerAccountDetail } from "@/lib/ledger/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: LedgerAccountDetail };

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
  }, [accountId]);

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
            <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Kind</th>
                    <th className="px-4 py-3 font-semibold tabular-nums">Amount</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                    <th className="px-4 py-3 font-semibold">Posted by</th>
                  </tr>
                </thead>
                <tbody>
                  {state.detail.entries.map((entry) => (
                    <tr key={entry.entryId} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3 tabular-nums">{entry.effectiveDate}</td>
                      <td className="px-4 py-3">{formatLedgerKind(entry.kind)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatCents(entry.amountCents)}</td>
                      <td className="px-4 py-3">
                        {entry.reasonLabel ?? entry.reasonCode ?? entry.memo ?? "—"}
                      </td>
                      <td className="px-4 py-3">{entry.posterName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
