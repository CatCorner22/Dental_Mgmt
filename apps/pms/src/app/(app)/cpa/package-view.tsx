"use client";

import { useCallback, useEffect, useState } from "react";
import { isRole, meetsRole } from "@/lib/auth/roles";
import type { MonthPackage, PackageExport } from "@/lib/cpa/package";
import { formatCents } from "@/lib/ledger/format";

type Me = { ok: boolean; role?: string };

type PackageResponse = {
  month: string;
  inProgress: boolean;
  package: MonthPackage;
  packageHash: string;
  exports: PackageExport[];
  changedSinceLastExport: boolean;
  computedAt: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "not_for_seat" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PackageResponse; isAdmin: boolean };

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function loadPackage(month: string): Promise<PackageResponse> {
  const res = await fetch(`/api/cpa/package?month=${encodeURIComponent(month)}`);
  const body = (await res.json().catch(() => ({}))) as PackageResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not load the package.");
  return body;
}

type Row = { key: string; label: string; count: number | string; cents?: number };

function Rows({ id, title, rows, empty }: { id: string; title: string; rows: Row[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 id={id} className="mb-2 text-base font-semibold">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--ink-2)]">{empty}</p>
      ) : (
        <table className="min-w-full text-left text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-[var(--line)] first:border-0">
                <th scope="row" className="py-1.5 pr-4 font-normal text-[var(--ink-2)]">
                  {r.label}
                </th>
                <td className="py-1.5 text-right tabular-nums">{r.count}</td>
                {r.cents !== undefined && <td className="py-1.5 pl-4 text-right tabular-nums text-[var(--ink-2)]">{formatCents(r.cents)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function PackageView() {
  const [month, setMonth] = useState<string>(thisMonth());
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (m: string) => {
    const meRes = await fetch("/api/me");
    const me = (await meRes.json().catch(() => ({ ok: false }))) as Me;
    const role = me.role && isRole(me.role) ? me.role : undefined;
    if (!meRes.ok || !meetsRole(role, "manager")) {
      setState({ status: "not_for_seat" });
      return;
    }
    const data = await loadPackage(m);
    setState({ status: "ready", data, isAdmin: meetsRole(role, "admin") });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    load(month).catch((err: unknown) => {
      if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Could not load the package." });
    });
    return () => {
      cancelled = true;
    };
  }, [load, month]);

  /** Exports through the chain-recording route, then hands the browser the file and re-reads the exports list. */
  async function download(format: "json" | "csv") {
    if (state.status !== "ready") return;
    setBusy(format);
    setMessage(null);
    try {
      const res = await fetch("/api/cpa/package/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month, format }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "The package was not exported.");
      }
      const hash = res.headers.get("x-package-hash") ?? "";
      const rows = res.headers.get("x-package-rows") ?? "";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `month-end-${month}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const data = await loadPackage(month);
      setState({ ...state, data });
      setMessage(`Exported as ${format.toUpperCase()}: ${rows} rows, package hash ${hash.slice(0, 12)}…, recorded on the chain.`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "The package was not exported.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <label className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-[var(--ink-2)]">Month</span>
        <input
          type="month"
          className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
          value={month}
          max={thisMonth()}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value);
          }}
        />
      </label>
      {message && (
        <p className="text-sm text-[var(--ink-2)]" aria-live="polite">
          {message}
        </p>
      )}
      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Reading the month&apos;s rows…</p>}
      {state.status === "not_for_seat" && (
        <p className="max-w-prose text-[var(--ink-2)]">The month-end package is for the manager and owner seats. Your seat works from the links on the home page.</p>
      )}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}
      {state.status === "ready" && (
        <>
          <section aria-labelledby="package-stamp" className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-4">
            <h2 id="package-stamp" className="text-base font-semibold">
              {state.data.package.period.start} to {state.data.package.period.end}
              {state.data.inProgress ? " · month in progress" : ""}
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-2)]">
              Package hash <code className="text-xs">{state.data.packageHash.slice(0, 16)}…</code>.{" "}
              {state.data.exports.length === 0
                ? "Not exported yet."
                : `Exported ${state.data.exports.length} time${state.data.exports.length === 1 ? "" : "s"}; last on ${state.data.exports[0]!.at.slice(0, 10)} as ${state.data.exports[0]!.format.toUpperCase()} with ${state.data.exports[0]!.rowCount} rows. ${
                    state.data.changedSinceLastExport ? "The rows have changed since that export." : "Unchanged since that export."
                  }`}
            </p>
            {state.isAdmin ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled={busy !== null}
                  onClick={() => void download("csv")}
                >
                  {busy === "csv" ? "Exporting…" : "Download CSV"}
                </button>
                <button
                  type="button"
                  className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled={busy !== null}
                  onClick={() => void download("json")}
                >
                  {busy === "json" ? "Exporting…" : "Download JSON"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--ink-3)]">Only an administrator exports the package; each export is recorded on the chain.</p>
            )}
          </section>

          <section aria-labelledby="package-tieout" className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
            <h2 id="package-tieout" className="mb-2 text-base font-semibold">
              Tie-out
            </h2>
            <ul className="space-y-1 text-sm">
              {state.data.package.tieOut.map((t) => (
                <li key={t.key}>
                  <span className="font-semibold">{t.label}:</span> {t.holds ? "yes" : "no"}. <span className="text-[var(--ink-2)]">{t.detail}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Rows
              id="package-journal"
              title={`Journal · ${state.data.package.journal.entryCount} entr${state.data.package.journal.entryCount === 1 ? "y" : "ies"} · ${formatCents(state.data.package.journal.totalCents)}`}
              rows={state.data.package.journal.rows.map((r) => ({ key: `${r.bucket}|${r.kind}`, label: r.label, count: r.count, cents: r.cents }))}
              empty="Nothing posted this month."
            />
            <Rows
              id="package-reasons"
              title="Adjustments, write-offs, refunds, reversals · by reason"
              rows={state.data.package.reasons.rows.map((r) => ({ key: `${r.kind}|${r.code}`, label: `${r.label} · ${r.withApproval} with approval`, count: r.count, cents: r.cents }))}
              empty="None this month."
            />
            <Rows
              id="package-deposits"
              title={`Deposit register · ${state.data.package.depositRegister.count} · ${formatCents(state.data.package.depositRegister.totalCents)}`}
              rows={state.data.package.depositRegister.rows.map((r) => ({ key: `${r.method}|${r.status}`, label: `${r.method} · ${r.status}`, count: r.count, cents: r.cents }))}
              empty="No deposits prepared this month."
            />
            <Rows
              id="package-bank"
              title="Bank, close, approvals"
              rows={[
                { key: "imports", label: "Statements imported", count: state.data.package.counts.bank.statementsImported },
                { key: "cleared", label: "Bank runs cleared", count: state.data.package.counts.bank.runsCleared },
                { key: "owner_only", label: "Of those, owner-only clearance", count: state.data.package.counts.bank.runsOwnerOnly },
                { key: "variances", label: "Variances cleared with a reason", count: state.data.package.counts.bank.variancesClearedWithReason },
                { key: "closes", label: "Day closes frozen", count: state.data.package.counts.bank.dayClosesFrozen },
                { key: "statements", label: "Patient statements issued", count: state.data.package.counts.bank.statementsIssued },
                { key: "with_second", label: "Guarded releases with a second approver", count: state.data.package.counts.money.guardedWithSecond },
                { key: "without_second", label: "Guarded releases without one", count: state.data.package.counts.money.guardedWithoutSecond },
                { key: "after_hours", label: "After-hours holds", count: state.data.package.counts.alerts.afterHoursHolds },
              ]}
              empty=""
            />
            <Rows
              id="package-controls"
              title="Controls in force at month end"
              rows={[
                ...state.data.package.controls.coverage.map((c) => ({ key: `cov:${c.channel}`, label: `${c.label} · ${c.enforcement} · ${c.status}`, count: `${c.activeExceptions} exception${c.activeExceptions === 1 ? "" : "s"}` })),
                ...state.data.package.controls.activeExceptions.map((e) => ({ key: `ex:${e.id}`, label: `Exception · ${e.label} · ${e.action.replace(/_/g, " ")}`, count: e.effectiveTo ? `until ${e.effectiveTo}` : "open" })),
                { key: "dec_active", label: "Control decisions standing", count: state.data.package.controls.decisions.active },
                { key: "dec_overdue", label: "Of those, past review at month end", count: state.data.package.controls.decisions.overdueAtMonthEnd },
                { key: "dec_recorded", label: "Decisions recorded this month", count: state.data.package.controls.decisions.recordedInMonth },
                { key: "findings_open", label: "Detector findings open at month end", count: state.data.package.counts.findings.openNow },
                { key: "acks", label: "Hard events acknowledged", count: state.data.package.counts.alerts.hardEventsAcknowledged },
                ...state.data.package.controls.attestations.map((a) => ({ key: `att:${a.channel}`, label: `${a.channel} attested (external channel)`, count: a.count })),
              ]}
              empty=""
            />
            <Rows
              id="package-chain"
              title={`Chain · ${state.data.package.chain.eventsInMonth} event${state.data.package.chain.eventsInMonth === 1 ? "" : "s"} this month`}
              rows={[
                { key: "head", label: "Head sequence", count: state.data.package.chain.headSeq ?? 0 },
                { key: "hash", label: "Head hash", count: (state.data.package.chain.headHash ?? "(empty)").slice(0, 16) + "…" },
                {
                  key: "check",
                  label: "Last nightly check",
                  count: state.data.package.chain.lastCheck ? `${state.data.package.chain.lastCheck.day} · ${state.data.package.chain.lastCheck.ok ? "verified" : "failed"}` : "none yet",
                },
              ]}
              empty=""
            />
          </div>
          <p className="max-w-prose text-xs text-[var(--ink-3)]">{state.data.package.scope}</p>
        </>
      )}
    </div>
  );
}
