"use client";

import { useCallback, useEffect, useState } from "react";
import { isRole, meetsRole } from "@/lib/auth/roles";
import { isCpaSeat } from "@/lib/auth/seats";
import { ANY_REASON, GL_BUCKETS, GL_KINDS, GL_SIDES, type GlMapping } from "@/lib/cpa/types";
import type { MonthClose } from "@/lib/cpa/close";
import type { MonthPackage, PackageExport } from "@/lib/cpa/package";
import { formatCents } from "@/lib/ledger/format";
import { AttestView } from "./attest-view";
import { QuestionsView } from "./questions-view";

type Me = { ok: boolean; role?: string; entitlements?: string[] };

type PackageResponse = {
  month: string;
  inProgress: boolean;
  close: MonthClose | null;
  packageSchema: string;
  schemaChanged: boolean;
  changedSinceClose: boolean;
  frozenFiguresHold: boolean;
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
  | {
      status: "ready";
      data: PackageResponse;
      mappings: MappingRow[];
      isAdmin: boolean;
      /** True for the outside accountant: it reads and exports, and the practice's own governance is not its to run. */
      seat: boolean;
    };

/** A mapping as the route serves it: the row plus whether the viewer proposed it. */
type MappingRow = GlMapping & { mine: boolean };

type Draft = { glBucket: string; kind: string; reasonCode: string; accountCode: string; accountName: string; side: string };

const EMPTY_DRAFT: Draft = { glBucket: GL_BUCKETS[0], kind: GL_KINDS[0], reasonCode: "", accountCode: "", accountName: "", side: GL_SIDES[0] };

async function loadMappings(): Promise<MappingRow[]> {
  const res = await fetch("/api/cpa/mappings");
  const body = (await res.json().catch(() => ({}))) as { items?: MappingRow[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not load the mappings.");
  return body.items ?? [];
}

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
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  // The month the owner is confirming a close for; closing cannot be undone.
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  const load = useCallback(async (m: string) => {
    const meRes = await fetch("/api/me");
    const me = (await meRes.json().catch(() => ({ ok: false }))) as Me;
    const role = me.role && isRole(me.role) ? me.role : undefined;
    // The outside accountant reaches this screen on its grant rather than its
    // rank (Increment 1.49), and reads the package alone: the chart of accounts
    // is the practice's own maker-checker, so the seat neither loads nor is
    // offered it. Asking for it would answer 403, which is the right answer.
    const seat = isCpaSeat(role ? { role, entitlements: me.entitlements ?? [] } : null);
    if (!meRes.ok || (!meetsRole(role, "manager") && !seat)) {
      setState({ status: "not_for_seat" });
      return;
    }
    const [data, mappings] = await Promise.all([loadPackage(m), seat ? Promise.resolve([]) : loadMappings()]);
    setState({ status: "ready", data, mappings, isAdmin: meetsRole(role, "admin"), seat });
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

  /** Freezes the month. Irreversible, so the page asks once before calling. */
  async function close() {
    if (state.status !== "ready") return;
    setBusy("close");
    setMessage(null);
    try {
      const res = await fetch("/api/cpa/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      setConfirmClose(null);
      const [data, mappings] = await Promise.all([loadPackage(month), loadMappings()]);
      setState({ ...state, data, mappings });
      setMessage(`Closed ${month}. The package hash is frozen; a correction now posts today with reason prior_period.`);
    } catch (err: unknown) {
      setConfirmClose(null);
      setMessage(err instanceof Error ? err.message : "The month was not closed.");
    } finally {
      setBusy(null);
    }
  }

  /** One proposal; a different person decides it. */
  async function propose() {
    if (state.status !== "ready") return;
    setBusy("propose");
    setMessage(null);
    try {
      const res = await fetch("/api/cpa/mappings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, reasonCode: draft.reasonCode.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      setDraft(EMPTY_DRAFT);
      const [data, mappings] = await Promise.all([loadPackage(month), loadMappings()]);
      setState({ ...state, data, mappings });
      setMessage("Proposed. A different person approves it before the journal reads it.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "The mapping was not proposed.");
    } finally {
      setBusy(null);
    }
  }

  async function decide(mapping: MappingRow, decision: "approved" | "rejected") {
    if (state.status !== "ready") return;
    setBusy(mapping.id);
    setMessage(null);
    try {
      const res = await fetch("/api/cpa/mappings/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mappingId: mapping.id, decision }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      const [data, mappings] = await Promise.all([loadPackage(month), loadMappings()]);
      setState({ ...state, data, mappings });
      setMessage(`${decision === "approved" ? "Approved" : "Rejected"}: ${mapping.glBucket} · ${mapping.kind} → ${mapping.accountCode}.`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "The mapping was not decided.");
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
        <p className="max-w-prose text-[var(--ink-2)]">The month-end package is for the manager and owner seats and for the practice&apos;s accountant. Your seat works from the links in the header.</p>
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
            {state.data.close && (
              <p className="mt-2 text-sm text-[var(--ink-2)]">
                Closed by {state.data.close.closedByName} on {state.data.close.closedAt.slice(0, 10)}, with {state.data.close.entryCount} entr
                {state.data.close.entryCount === 1 ? "y" : "ies"} totalling {formatCents(state.data.close.totalCents)}. Frozen hash{" "}
                <code className="text-xs">{state.data.close.packageHash.slice(0, 16)}…</code>.{" "}
                {state.data.schemaChanged
                  ? `The package has changed shape since this close (${state.data.close.packageSchema} then, ${state.data.packageSchema} now), so the two hashes do not compare and neither one says anything about the figures. What the close froze in its own columns does: the entry count and the journal total above ${
                      state.data.frozenFiguresHold ? "still match what the month reads today." : "no longer match what the month reads today, so a figure has moved since."
                    }`
                  : state.data.changedSinceClose
                    ? "This month no longer reads as the accountant received it: a figure it states has changed since, most often an account mapping or a control policy. The hash above is what it reads now."
                    : "This month still reads as the accountant received it. A later correction into it posts today with reason prior_period, and is reported in the month it posts."}
              </p>
            )}
            {state.isAdmin || state.seat ? (
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
                {state.isAdmin &&
                  !state.data.close &&
                  !state.data.inProgress &&
                  (confirmClose === month ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-[var(--ink-2)]">
                        Closing {month} cannot be undone. A correction afterwards posts today with reason prior_period.
                      </span>
                      <button
                        type="button"
                        className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        disabled={busy !== null}
                        onClick={() => void close()}
                      >
                        {busy === "close" ? "Closing…" : "Close it for good"}
                      </button>
                      <button
                        type="button"
                        className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold"
                        onClick={() => setConfirmClose(null)}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      disabled={busy !== null}
                      onClick={() => setConfirmClose(month)}
                    >
                      Close month
                    </button>
                  ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--ink-3)]">An administrator or the practice&apos;s accountant exports the package; each export is recorded on the chain.</p>
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
              rows={state.data.package.journal.rows.map((r) => ({
                key: `${r.bucket}|${r.kind}`,
                label: r.account ? `${r.label} → ${r.account.code} ${r.account.name} (${r.account.side})` : `${r.label} → unmapped`,
                count: r.count,
                cents: r.cents,
              }))}
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
            {/* What landed behind this month's seals (Increment 1.44). Windowed on the
                sealed day rather than the posting, which is why a row can appear here
                and not in this month's journal; the sentence says so. */}
            <Rows
              id="package-sealed-days"
              title={`Sealed days · ${state.data.package.sealedDays.closesFrozen} frozen · ${state.data.package.sealedDays.postings} posted behind them`}
              rows={[
                ...state.data.package.sealedDays.daysDisturbed.map((d) => ({
                  key: d.businessDate,
                  label: `${d.businessDate} · ${d.firstPostings} first posting${d.firstPostings === 1 ? "" : "s"}${d.closes > 1 ? ` · ${d.closes} seals` : ""}`,
                  count: d.postings,
                  cents: d.cents,
                })),
                // The total only earns a row once there is more than one day to total.
                ...(state.data.package.sealedDays.daysDisturbed.length > 1
                  ? [
                      {
                        key: "total",
                        label: "Total behind this month's seals",
                        count: state.data.package.sealedDays.postings,
                        cents: state.data.package.sealedDays.totalCents,
                      },
                    ]
                  : []),
              ]}
              empty={`${state.data.package.sealedDays.closesFrozen} day close${state.data.package.sealedDays.closesFrozen === 1 ? "" : "s"} frozen this month, and nothing posted against any of them afterward.`}
            />
            {state.data.package.sealedDays.postings > 0 && (
              <p className="max-w-prose text-sm text-[var(--ink-2)]">
                These rows are counted against the day they were dated for, not the month they
                posted in, so a row that posted later than this month appears here and not in this
                month&apos;s journal. The sealed figures themselves did not move.
              </p>
            )}
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
          {/* What stands behind the word "attested" on the coverage table (Increment 1.51). */}
          <AttestView month={month} />

          {/* Either side may ask about a line of this month (Increment 1.50). */}
          <QuestionsView month={month} />

          {/* The chart of accounts is the practice's own maker-checker, so the
              outside accountant is not offered it; each journal line above
              already carries the account it was mapped to. */}
          {!state.seat && (
          <section aria-labelledby="package-mappings" className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
            <h2 id="package-mappings" className="mb-1 text-base font-semibold">
              Chart of accounts
            </h2>
            <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
              {state.data.package.mappings.approved} approved mapping{state.data.package.mappings.approved === 1 ? "" : "s"};{" "}
              {state.data.package.mappings.pending} waiting for a second person;{" "}
              {state.data.package.mappings.unmappedLines} journal line{state.data.package.mappings.unmappedLines === 1 ? "" : "s"} unmapped this month. One
              person proposes a mapping and a different person approves it, so no one maps the practice&apos;s books alone.
            </p>
            {state.mappings.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Line</th>
                      <th className="px-3 py-2 font-semibold">Account</th>
                      <th className="px-3 py-2 font-semibold">State</th>
                      {state.isAdmin && <th className="px-3 py-2 font-semibold">Decide</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {state.mappings.map((m) => (
                      <tr key={m.id} className="border-b border-[var(--line)] last:border-0 align-top">
                        <td className="px-3 py-2">
                          {m.glBucket.replace(/_/g, " ")} · {m.kind.replace(/_/g, " ")}
                          {m.reasonCode === ANY_REASON ? "" : ` · ${m.reasonCode}`}
                        </td>
                        <td className="px-3 py-2">
                          {m.accountCode} {m.accountName} ({m.side})
                        </td>
                        <td className="px-3 py-2">
                          {m.status === "proposed"
                            ? `Proposed by ${m.proposedByName}`
                            : `${m.status === "approved" ? "Approved" : "Rejected"} by ${m.decidedByName ?? "someone"} on ${(m.decidedAt ?? "").slice(0, 10)}`}
                        </td>
                        {state.isAdmin && (
                          <td className="px-3 py-2">
                            {m.status === "proposed" && !m.mine ? (
                              <span className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-xs font-semibold disabled:opacity-50"
                                  disabled={busy !== null}
                                  aria-label={`Approve mapping ${m.accountCode}`}
                                  onClick={() => void decide(m, "approved")}
                                >
                                  {busy === m.id ? "Deciding…" : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold disabled:opacity-50"
                                  disabled={busy !== null}
                                  aria-label={`Reject mapping ${m.accountCode}`}
                                  onClick={() => void decide(m, "rejected")}
                                >
                                  Reject
                                </button>
                              </span>
                            ) : m.status === "proposed" ? (
                              <span className="text-xs text-[var(--ink-3)]">Yours; a different person decides it.</span>
                            ) : (
                              <span className="text-xs text-[var(--ink-3)]">Decided</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.accountCode.trim() && draft.accountName.trim()) void propose();
              }}
            >
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-semibold text-[var(--ink-2)]">Bucket</span>
                <select className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2" value={draft.glBucket} onChange={(e) => setDraft({ ...draft, glBucket: e.target.value })}>
                  {GL_BUCKETS.map((b) => (
                    <option key={b} value={b}>
                      {b.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-semibold text-[var(--ink-2)]">Kind</span>
                <select className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                  {GL_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-semibold text-[var(--ink-2)]">Account code</span>
                <input
                  className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                  value={draft.accountCode}
                  placeholder="1200"
                  onChange={(e) => setDraft({ ...draft, accountCode: e.target.value })}
                />
              </label>
              <label className="flex min-w-[12rem] flex-1 flex-col text-sm">
                <span className="mb-1 font-semibold text-[var(--ink-2)]">Account name</span>
                <input
                  className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                  value={draft.accountName}
                  placeholder="Patient receivables"
                  onChange={(e) => setDraft({ ...draft, accountName: e.target.value })}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-semibold text-[var(--ink-2)]">Side</span>
                <select className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2" value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value })}>
                  {GL_SIDES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={busy !== null || !draft.accountCode.trim() || !draft.accountName.trim()}
              >
                {busy === "propose" ? "Proposing…" : "Propose mapping"}
              </button>
            </form>
          </section>
          )}

          <p className="max-w-prose text-xs text-[var(--ink-3)]">{state.data.package.scope}</p>
        </>
      )}
    </div>
  );
}
