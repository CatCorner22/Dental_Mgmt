"use client";

import { isSignInEnded } from "@/lib/auth/guardedFetch";
import { SessionEnded, loadFailure } from "../../session-ended";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCents, formatLedgerKind } from "@/lib/ledger/format";
import type { StatementRecord } from "@/lib/statements/snapshot";

type LoadState =
  | { status: "loading" }
  /** The sign-in behind this screen has ended (Increment 1.82). */
  | { status: "sign_in_ended" }
  | { status: "error"; message: string }
  | { status: "ready"; statement: StatementRecord };

function BalanceStrip({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--ink)]">{formatCents(cents)}</p>
    </div>
  );
}

export default function StatementPreviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [holdReason, setHoldReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/statements/${id}`)
      .then(async (res) => {
        const body = (await res.json()) as { statement?: StatementRecord; error?: string };
        if (!res.ok || !body.statement) throw new Error(body.error ?? "Could not load statement.");
        if (!cancelled) {
          setState({ status: "ready", statement: body.statement });
          setHoldReason(body.statement.holdReason ?? "");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState(loadFailure(err, "Could not load statement."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function runAction(path: string, body?: Record<string, string>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = (await res.json()) as { statement?: StatementRecord; error?: string };
      if (!res.ok || !payload.statement) throw new Error(payload.error ?? "Action failed.");
      setState({ status: "ready", statement: payload.statement });
      setMessage(payload.statement.status === "issued" ? "Statement issued." : "Statement held.");
    } catch (err: unknown) {
      // The sign-in is over, so nothing this screen offers can succeed (Increment 1.83).
      if (isSignInEnded(err)) {
        setState({ status: "sign_in_ended" });
        return;
      }
      setMessage(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const statement = state.status === "ready" ? state.statement : null;
  const canMutate = statement?.status === "draft";

  return (
    <main>
      <p className="mb-4 text-sm">
        <Link
          className="font-semibold text-[var(--link)] underline-offset-2 hover:underline"
          href="/statements"
        >
          ← Back to statements
        </Link>
      </p>
      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading statement…</p>}
      {state.status === "sign_in_ended" && <SessionEnded />}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}
      {statement && (
        <>
          <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Statement preview</p>
          <h1 className="mb-2">{statement.displayName}</h1>
          <p className="mb-6 text-sm text-[var(--ink-2)]">
            As of {statement.asOf} ·{" "}
            {statement.status === "issued"
              ? "Issued"
              : statement.status === "held"
                ? "Held"
                : statement.status === "void"
                  ? "Void"
                  : "Draft"}
            {statement.issuedByName ? ` · issued by ${statement.issuedByName}` : ""}
            {statement.holdReason ? ` · ${statement.holdReason}` : ""}
          </p>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <BalanceStrip label="Patient due" cents={statement.patientDueCents} />
            <BalanceStrip label="Insurance pending" cents={statement.insurancePendingCents} />
            <BalanceStrip label="Credit" cents={statement.creditCents} />
          </div>

          {statement.snapshot.patients?.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-semibold">Patients on this statement</h2>
              <ul className="space-y-3">
                {statement.snapshot.patients.map((patient) => (
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
          )}

          <section className="mb-10">
            <h2 className="mb-3 text-lg font-semibold">Itemized activity</h2>
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
                  {(statement.snapshot.lines ?? []).length === 0 && (
                    <tr>
                      <td className="px-4 py-3 text-[var(--ink-2)]" colSpan={5}>
                        No ledger lines in this snapshot.
                      </td>
                    </tr>
                  )}
                  {(statement.snapshot.lines ?? []).map((entry) => (
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

          <div className="mb-4 flex flex-wrap items-end gap-4">
            <label className="block max-w-md flex-1 text-sm">
              <span className="mb-1 block font-semibold text-[var(--ink-2)]">Hold reason</span>
              <input
                className="w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                value={holdReason}
                disabled={!canMutate || busy}
                onChange={(event) => setHoldReason(event.target.value)}
                placeholder="Held: Delta claim pending"
              />
            </label>
            <button
              type="button"
              className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={!canMutate || busy || holdReason.trim().length === 0}
              onClick={() => void runAction(`/api/statements/${statement.id}/hold`, { reason: holdReason })}
            >
              Hold
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={!canMutate || busy}
              onClick={() => void runAction(`/api/statements/${statement.id}/issue`)}
            >
              Issue statement
            </button>
          </div>
          {message && <p className="text-sm text-[var(--ink-2)]">{message}</p>}
        </>
      )}
    </main>
  );
}
