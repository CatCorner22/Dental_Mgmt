"use client";

import { isSignInEnded } from "@/lib/auth/guardedFetch";
import { SessionEnded } from "../../session-ended";
import { refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCents, formatLedgerKind } from "@/lib/ledger/format";
import { reasonOptionsForPosting, type ReasonCodeRow } from "@/lib/ledger/reasons";
import { DEMO_EFFECTIVE_DATE } from "@/lib/demo/dates";

import {
  POSTABLE_KINDS,
  type LedgerAccountSummary,
  type LedgerPatientBalance,
  type PostableKind,
} from "@/lib/ledger/types";

type AccountDetail = {
  accountId: string;
  displayName: string;
  patients: LedgerPatientBalance[];
};

type FormState = {
  accountId: string;
  patientId: string;
  kind: string;
  amountDollars: string;
  effectiveDate: string;
  reasonCode: string;
  memo: string;
  procedureId: string;
};

type Outcome =
  | { type: "posted"; entryId: string; duplicate: boolean }
  | { type: "needs_second"; approvalRequestId: string; why: string }
  | { type: "refused"; why: string; verb?: string };

const DEMO_DATE = DEMO_EFFECTIVE_DATE;

export default function LedgerPostPage() {
  const [accounts, setAccounts] = useState<LedgerAccountSummary[]>([]);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [procedures, setProcedures] = useState<{ id: string; label: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Increment 1.82: this screen keeps its errors as a string, so the one
  // state that is not an error keeps its own flag rather than being folded
  // into a sentence the reader cannot act on.
  const [signInEnded, setSignInEnded] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>({
    accountId: "",
    patientId: "",
    kind: "patient_payment",
    amountDollars: "",
    effectiveDate: DEMO_DATE,
    reasonCode: "",
    memo: "",
    procedureId: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ledger/accounts")
      .then(async (res) => {
        const body = (await res.json()) as { accounts?: LedgerAccountSummary[]; error?: string };
        refuseIfSignInEnded(res);
        if (!res.ok) throw new Error(body.error ?? "Could not load accounts.");
        if (!cancelled) setAccounts(body.accounts ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (isSignInEnded(err)) setSignInEnded(true);
          else setLoadError(err instanceof Error ? err.message : "Could not load accounts.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.accountId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/ledger/accounts/${form.accountId}`)
      .then(async (res) => {
        const body = (await res.json()) as AccountDetail & { error?: string };
        refuseIfSignInEnded(res);
        if (!res.ok) throw new Error(body.error ?? "Could not load account.");
        if (!cancelled) {
          setDetail(body);
          const firstPatient = body.patients[0]?.patientId ?? "";
          setForm((prev) => ({
            ...prev,
            patientId:
              prev.patientId && body.patients.some((p) => p.patientId === prev.patientId)
                ? prev.patientId
                : firstPatient,
          }));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (isSignInEnded(err)) setSignInEnded(true);
          else setLoadError(err instanceof Error ? err.message : "Could not load account.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [form.accountId]);

  useEffect(() => {
    if (!form.patientId || form.kind !== "charge") {
      setProcedures([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/ledger/post/procedures?patientId=${form.patientId}`)
      .then(async (res) => {
        const body = (await res.json()) as { procedures?: { id: string; label: string }[] };
        if (!res.ok) return;
        if (!cancelled) {
          setProcedures(body.procedures ?? []);
          const first = body.procedures?.[0]?.id ?? "";
          setForm((prev) => ({
            ...prev,
            procedureId:
              prev.procedureId && body.procedures?.some((p) => p.id === prev.procedureId)
                ? prev.procedureId
                : first,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setProcedures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.patientId, form.kind]);

  // The practice's own codes, read once (Increment 1.45). A reason the practice
  // never adopted cannot reach the database, so the form must not offer one.
  const [reasonCodes, setReasonCodes] = useState<ReasonCodeRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/reason-codes")
      .then(async (res) => {
        const body = (await res.json()) as { items?: ReasonCodeRow[] };
        if (res.ok && !cancelled) setReasonCodes(body.items ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const reasonOptions = useMemo(() => reasonOptionsForPosting(reasonCodes, form.kind), [reasonCodes, form.kind]);
  const selectedAccount = accounts.find((a) => a.accountId === form.accountId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setOutcome(null);
    setLoadError(null);

    const dollars = Number.parseFloat(form.amountDollars);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setLoadError("Enter a positive dollar amount.");
      setBusy(false);
      return;
    }
    const amountCents = Math.round(dollars * 100);

    try {
      const res = await fetch("/api/ledger/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: form.accountId,
          patientId: form.patientId,
          kind: form.kind,
          amountCents,
          effectiveDate: form.effectiveDate,
          reasonCode: form.reasonCode || null,
          memo: form.memo || null,
          procedureId: form.kind === "charge" ? form.procedureId || null : null,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        status?: string;
        entryId?: string;
        duplicate?: boolean;
        approvalRequestId?: string;
        why?: string;
        verb?: string;
        error?: string;
      };

      if (body.status === "needs_second" && body.approvalRequestId) {
        setOutcome({
          type: "needs_second",
          approvalRequestId: body.approvalRequestId,
          why: body.why ?? "A second approver is required.",
        });
        return;
      }

      if (!res.ok || body.ok === false) {
        setOutcome({
          type: "refused",
          why: body.why ?? body.error ?? "Posting refused.",
          verb: body.verb,
        });
        return;
      }

      setOutcome({
        type: "posted",
        entryId: body.entryId ?? "",
        duplicate: body.duplicate ?? false,
      });
    } catch (err: unknown) {
      // The sign-in is over, so nothing this screen offers can succeed (Increment 1.83).
      if (isSignInEnded(err)) {
        setSignInEnded(true);
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Posting failed.");
    } finally {
      setBusy(false);
    }
  }

  if (signInEnded) return <SessionEnded />;

  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Money Desk</p>
      <h1 className="mb-2">Post to ledger</h1>
      <p className="mb-8 max-w-prose text-[var(--ink-2)]">
        Enter a charge, patient payment, adjustment, or write-off. Large write-offs and
        adjustments may require a second approver before they post.
      </p>

      {loadError && <p className="mb-4 text-sm text-[var(--ink-2)]">{loadError}</p>}

      {outcome?.type === "posted" && (
        <p className="mb-4 rounded-md border border-[var(--line)] bg-[var(--cream)] px-4 py-3 text-sm">
          {outcome.duplicate ? "Duplicate request — existing entry kept." : "Posted successfully."}
          {outcome.entryId ? ` Entry ${outcome.entryId}.` : ""}
          {form.accountId ? (
            <>
              {" "}
              <Link
                className="font-semibold text-[var(--link)] underline-offset-2 hover:underline"
                href={`/ledger/${form.accountId}`}
              >
                View account
              </Link>
            </>
          ) : null}
        </p>
      )}

      {outcome?.type === "needs_second" && (
        <p className="mb-4 rounded-md border border-[var(--line)] bg-[var(--cream)] px-4 py-3 text-sm">
          Needs second approver: {outcome.why}{" "}
          <Link
            className="font-semibold text-[var(--link)] underline-offset-2 hover:underline"
            href="/approvals"
          >
            Open approvals inbox
          </Link>{" "}
          (request {outcome.approvalRequestId}).
        </p>
      )}

      {outcome?.type === "refused" && (
        <p className="mb-4 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-2)]">
          {outcome.verb ? `${outcome.verb}: ` : ""}
          {outcome.why}
        </p>
      )}

      <form className="max-w-xl space-y-5" onSubmit={(e) => void submit(e)}>
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold">Guarantor account</span>
          <select
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            value={form.accountId}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                accountId: e.target.value,
                patientId: "",
              }))
            }
            required
          >
            <option value="">Select account…</option>
            {accounts.map((account) => (
              <option key={account.accountId} value={account.accountId}>
                {account.displayName} · due {formatCents(account.patientDueCents)}
              </option>
            ))}
          </select>
        </label>

        {detail && detail.patients.length > 1 && (
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-semibold">Patient</span>
            <select
              className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
              value={form.patientId}
              onChange={(e) => setForm((prev) => ({ ...prev, patientId: e.target.value }))}
              required
            >
              {detail.patients.map((patient) => (
                <option key={patient.patientId} value={patient.patientId}>
                  {patient.lastName}, {patient.firstName} ({patient.mrn})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold">Kind</span>
          <select
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            value={form.kind}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                kind: e.target.value,
                reasonCode: "",
                procedureId: "",
              }))
            }
            required
          >
            {POSTABLE_KINDS.map((kind: PostableKind) => (
              <option key={kind} value={kind}>
                {formatLedgerKind(kind)}
              </option>
            ))}
          </select>
        </label>

        {form.kind === "charge" && (
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-semibold">Procedure</span>
            <select
              className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
              value={form.procedureId}
              onChange={(e) => setForm((prev) => ({ ...prev, procedureId: e.target.value }))}
              required
            >
              <option value="">Select procedure…</option>
              {procedures.map((procedure) => (
                <option key={procedure.id} value={procedure.id}>
                  {procedure.label}
                </option>
              ))}
            </select>
            {procedures.length === 0 && form.patientId && (
              <span className="mt-1 text-[var(--ink-2)]">No procedures on this patient yet.</span>
            )}
          </label>
        )}

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold">Amount (USD)</span>
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 tabular-nums"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amountDollars}
            onChange={(e) => setForm((prev) => ({ ...prev, amountDollars: e.target.value }))}
            placeholder="0.00"
            required
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold">Effective date</span>
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            type="date"
            value={form.effectiveDate}
            onChange={(e) => setForm((prev) => ({ ...prev, effectiveDate: e.target.value }))}
            required
          />
        </label>

        {(form.kind === "write_off" || form.kind === "adjustment") && (
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-semibold">Reason code</span>
            <select
              className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
              value={form.reasonCode}
              onChange={(e) => setForm((prev) => ({ ...prev, reasonCode: e.target.value }))}
              required
            >
              <option value="">Select reason…</option>
              {reasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold">Memo (optional)</span>
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            value={form.memo}
            onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
            placeholder={selectedAccount ? `Posting to ${selectedAccount.displayName}` : ""}
          />
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={busy || !form.accountId || !form.patientId}
          >
            {busy ? "Posting…" : "Post"}
          </button>
          <Link
            className="text-sm font-semibold text-[var(--link)] underline-offset-2 hover:underline"
            href="/ledger"
          >
            Back to ledger
          </Link>
        </div>
      </form>
    </main>
  );
}
