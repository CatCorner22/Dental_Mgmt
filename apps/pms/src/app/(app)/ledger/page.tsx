"use client";

import { SessionEnded, loadFailure } from "../session-ended";
import { refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCents } from "@/lib/ledger/format";
import type { LedgerAccountSummary } from "@/lib/ledger/types";

type LoadState =
  | { status: "loading" }
  /** The sign-in behind this screen has ended (Increment 1.82). */
  | { status: "sign_in_ended" }
  | { status: "error"; message: string }
  | { status: "ready"; accounts: LedgerAccountSummary[] };

export default function LedgerPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ledger/accounts")
      .then(async (res) => {
        const body = (await res.json()) as { accounts?: LedgerAccountSummary[]; error?: string };
        refuseIfSignInEnded(res);
        if (!res.ok) throw new Error(body.error ?? "Could not load accounts.");
        if (!cancelled) setState({ status: "ready", accounts: body.accounts ?? [] });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState(loadFailure(err, "Could not load accounts."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Money Desk</p>
      <h1 className="mb-2">Ledger</h1>
      <p className="mb-4 max-w-prose text-[var(--ink-2)]">
        Open guarantor accounts with the three labeled balance numbers: patient due,
        insurance pending, and unapplied credit.
      </p>
      <p className="mb-8">
        <Link
          className="text-sm font-semibold text-[var(--link)] underline-offset-2 hover:underline"
          href="/ledger/post"
        >
          Post payment or adjustment
        </Link>
      </p>

      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading accounts…</p>}
      {state.status === "sign_in_ended" && <SessionEnded />}
      {state.status === "error" && (
        <p className="text-sm text-[var(--ink-2)]">{state.message}</p>
      )}
      {state.status === "ready" && state.accounts.length === 0 && (
        <p className="text-sm text-[var(--ink-2)]">No guarantor accounts yet.</p>
      )}
      {state.status === "ready" && state.accounts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold tabular-nums">Patient due</th>
                <th className="px-4 py-3 font-semibold tabular-nums">Insurance pending</th>
                <th className="px-4 py-3 font-semibold tabular-nums">Credit</th>
                <th className="px-4 py-3 font-semibold">Patients</th>
              </tr>
            </thead>
            <tbody>
              {state.accounts.map((account) => (
                <tr key={account.accountId} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-[var(--link)] underline-offset-2 hover:underline"
                      href={`/ledger/${account.accountId}`}
                    >
                      {account.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatCents(account.patientDueCents)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCents(account.insurancePendingCents)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatCents(account.creditCents)}</td>
                  <td className="px-4 py-3 tabular-nums">{account.patientCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
