"use client";

import { SessionEnded, loadFailure } from "../session-ended";
import { isSignInEnded, refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCents } from "@/lib/ledger/format";
import type { LedgerAccountSummary } from "@/lib/ledger/types";
import type { StatementRecord } from "@/lib/statements/snapshot";

type LoadState =
  | { status: "loading" }
  /** The sign-in behind this screen has ended (Increment 1.82). */
  | { status: "sign_in_ended" }
  | { status: "error"; message: string }
  | { status: "ready"; statements: StatementRecord[]; accounts: LedgerAccountSummary[] };

function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "issued":
      return "Issued";
    case "held":
      return "Held";
    case "void":
      return "Void";
    default:
      return status;
  }
}

export default function StatementsPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [accountId, setAccountId] = useState("");
  const [asOf, setAsOf] = useState("2026-09-21");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/statements").then(async (res) => {
        const body = (await res.json()) as { statements?: StatementRecord[]; error?: string };
        refuseIfSignInEnded(res);
        if (!res.ok) throw new Error(body.error ?? "Could not load statements.");
        return body.statements ?? [];
      }),
      fetch("/api/ledger/accounts").then(async (res) => {
        const body = (await res.json()) as { accounts?: LedgerAccountSummary[]; error?: string };
        refuseIfSignInEnded(res);
        if (!res.ok) throw new Error(body.error ?? "Could not load accounts.");
        return body.accounts ?? [];
      }),
    ])
      .then(([rows, accounts]) => {
        if (!cancelled) {
          setState({ status: "ready", statements: rows, accounts });
          setAccountId((current) => current || accounts[0]?.accountId || "");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState(loadFailure(err, "Could not load statements."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function createDraft() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/statements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, asOf }),
      });
      const body = (await res.json()) as { statement?: StatementRecord; error?: string };
      if (!res.ok || !body.statement) throw new Error(body.error ?? "Could not create statement.");
      router.push(`/statements/${body.statement.id}`);
    } catch (err: unknown) {
      // The sign-in is over, so nothing this screen offers can succeed (Increment 1.83).
      if (isSignInEnded(err)) {
        setState({ status: "sign_in_ended" });
        return;
      }
      setMessage(err instanceof Error ? err.message : "Could not create statement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Money Desk</p>
      <h1 className="mb-2">Statements</h1>
      <p className="mb-8 max-w-prose text-[var(--ink-2)]">
        Generate a patient or guarantor statement from the same ledger balances the Money Desk
        shows. Preview and issue freeze the snapshot. This increment does not email PHI or take
        cards.
      </p>

      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading statements…</p>}
      {state.status === "sign_in_ended" && <SessionEnded />}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}
      {state.status === "ready" && (
        <>
          <form
            className="mb-8 flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void createDraft();
            }}
          >
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-[var(--ink-2)]">Account</span>
              <select
                className="min-w-[16rem] rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {state.accounts.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-[var(--ink-2)]">As of</span>
              <input
                className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                type="date"
                value={asOf}
                onChange={(event) => setAsOf(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={busy || !accountId}
            >
              Create draft
            </button>
          </form>
          {message && <p className="mb-6 text-sm text-[var(--ink-2)]">{message}</p>}

          {state.statements.length === 0 ? (
            <p className="text-sm text-[var(--ink-2)]">No statements yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Account</th>
                    <th className="px-4 py-3 font-semibold">As of</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold tabular-nums">Patient due</th>
                    <th className="px-4 py-3 font-semibold tabular-nums">Insurance pending</th>
                    <th className="px-4 py-3 font-semibold tabular-nums">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {state.statements.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          className="font-semibold text-[var(--link)] underline-offset-2 hover:underline"
                          href={`/statements/${row.id}`}
                        >
                          {row.displayName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.asOf}</td>
                      <td className="px-4 py-3">
                        {statusLabel(row.status)}
                        {row.holdReason ? ` · ${row.holdReason}` : ""}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatCents(row.patientDueCents)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCents(row.insurancePendingCents)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatCents(row.creditCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
