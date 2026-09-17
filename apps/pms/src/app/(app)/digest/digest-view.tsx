"use client";

import { useCallback, useEffect, useState } from "react";
import { isRole, meetsRole } from "@/lib/auth/roles";
import { formatCents } from "@/lib/ledger/format";
import type { CountRow, DigestAck, WeeklyDigest } from "@/lib/digest/digest";

type Me = { ok: boolean; role?: string };

type DigestResponse = {
  digest: WeeklyDigest;
  summaryHash: string;
  ack: DigestAck | null;
  changedSinceAck: boolean;
  computedAt: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "not_for_seat" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DigestResponse; isAdmin: boolean };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadDigest(ending: string): Promise<DigestResponse> {
  const res = await fetch(`/api/digest?ending=${encodeURIComponent(ending)}`);
  const body = (await res.json().catch(() => ({}))) as DigestResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not load the digest.");
  return body;
}

/** One labelled count per row; the table is the reading, not a chart. */
function Rows({ id, title, rows, empty }: { id: string; title: string; rows: CountRow[]; empty: string }) {
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

function pairs(entries: [string, number][]): CountRow[] {
  return entries.map(([label, count]) => ({ key: label, label, count }));
}

export function DigestView() {
  const [ending, setEnding] = useState<string>(today());
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (end: string) => {
    const meRes = await fetch("/api/me");
    const me = (await meRes.json().catch(() => ({ ok: false }))) as Me;
    const role = me.role && isRole(me.role) ? me.role : undefined;
    if (!meRes.ok || !meetsRole(role, "manager")) {
      setState({ status: "not_for_seat" });
      return;
    }
    const data = await loadDigest(end);
    setState({ status: "ready", data, isAdmin: meetsRole(role, "admin") });
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(ending).catch((err: unknown) => {
      if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Could not load the digest." });
    });
    return () => {
      cancelled = true;
    };
  }, [ending, load]);

  async function acknowledge() {
    if (state.status !== "ready") return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/digest/ack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ending: state.data.digest.period.end, summaryHash: state.data.summaryHash }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      await load(ending);
      setMessage("Acknowledged. The stamp binds the digest as it read just now; if the rows change later, this page says so.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "The digest was not acknowledged.");
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "not_for_seat") {
    return <p className="max-w-prose text-[var(--ink-2)]">The digest is for the manager and owner seats. Your seat works from the home links.</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold text-[var(--ink-2)]">Week ending</span>
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            type="date"
            value={ending}
            max={today()}
            onChange={(e) => {
              if (e.target.value) {
                setMessage(null);
                setEnding(e.target.value);
              }
            }}
          />
        </label>
        {state.status === "ready" && (
          <p className="text-sm text-[var(--ink-2)]">
            {state.data.digest.period.start} to {state.data.digest.period.end}. Computed from live rows at{" "}
            {new Date(state.data.computedAt).toLocaleString()}.
          </p>
        )}
      </div>

      {message && (
        <p className="text-sm text-[var(--ink-2)]" aria-live="polite">
          {message}
        </p>
      )}
      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Counting the week's rows…</p>}
      {state.status === "error" && <p className="text-sm text-[var(--ink-2)]">{state.message}</p>}

      {state.status === "ready" && (
        <>
          <section aria-labelledby="digest-ack" className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-4">
            <h2 id="digest-ack" className="mb-1 text-base font-semibold">
              Acknowledgment
            </h2>
            {state.data.ack ? (
              <p className="text-sm text-[var(--ink-2)]">
                Acknowledged by {state.data.ack.acknowledgedByName} on {new Date(state.data.ack.acknowledgedAt).toLocaleString()}, when the
                chain held {state.data.ack.eventCount} event{state.data.ack.eventCount === 1 ? "" : "s"} for this week.
                {state.data.changedSinceAck
                  ? " The rows have changed since: what is on the page now is not what was acknowledged."
                  : " The rows have not changed since."}
              </p>
            ) : (
              <>
                <p className="text-sm text-[var(--ink-2)]">
                  Not yet acknowledged. The stamp records who read this week&apos;s digest and when, and binds what it said; it is
                  written once and never edited.
                </p>
                {state.isAdmin ? (
                  <button
                    type="button"
                    className="mt-3 min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void acknowledge()}
                  >
                    {busy ? "Stamping…" : "Acknowledge this week"}
                  </button>
                ) : (
                  <p className="mt-2 text-sm text-[var(--ink-3)]">Only an administrator acknowledges the digest.</p>
                )}
              </>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Rows
              id="digest-money"
              title={`Money · ${state.data.digest.money.postingCount} posting${state.data.digest.money.postingCount === 1 ? "" : "s"}`}
              rows={[
                ...state.data.digest.money.postings,
                ...pairs([
                  ["Guarded releases with a second approver", state.data.digest.money.guardedWithSecond],
                  ["Guarded releases without one", state.data.digest.money.guardedWithoutSecond],
                ]),
              ]}
              empty="Nothing was posted."
            />
            <Rows
              id="digest-approvals"
              title="Approvals"
              rows={pairs([
                ["Requested", state.data.digest.approvals.requested],
                ["Given by a second person", state.data.digest.approvals.given],
                ["Declined", state.data.digest.approvals.declined],
                ["Cancelled", state.data.digest.approvals.cancelled],
              ])}
              empty="No approvals."
            />
            <Rows
              id="digest-bank"
              title="Bank and close"
              rows={pairs([
                ["Statements imported", state.data.digest.bank.statementsImported],
                ["Bank runs cleared", state.data.digest.bank.runsCleared],
                ["Of those, owner-only clearance", state.data.digest.bank.runsOwnerOnly],
                ["Variances cleared with a reason", state.data.digest.bank.variancesClearedWithReason],
                ["Deposits prepared", state.data.digest.bank.depositsPrepared],
                ["Day closes frozen", state.data.digest.bank.dayClosesFrozen],
                ["Patient statements issued", state.data.digest.bank.statementsIssued],
                ["Patient statements held", state.data.digest.bank.statementsHeld],
                ["Patient statements voided", state.data.digest.bank.statementsVoided],
              ])}
              empty="No bank activity."
            />
            <Rows
              id="digest-findings"
              title={`Detector findings · ${state.data.digest.findings.openNow} open at week's end`}
              rows={[
                ...state.data.digest.findings.opened.map((r) => ({ ...r, key: `opened:${r.key}`, label: `Opened · ${r.label}` })),
                ...state.data.digest.findings.closed.map((r) => ({ ...r, key: `closed:${r.key}`, label: `Closed · ${r.label}` })),
              ]}
              empty="No finding opened or closed this week."
            />
            <Rows
              id="digest-decisions"
              title={`Decisions · ${state.data.digest.decisions.overdueNow} past review at week's end`}
              rows={[
                ...state.data.digest.decisions.recorded.map((r) => ({ ...r, key: `recorded:${r.key}`, label: `Recorded · ${r.label}` })),
                ...pairs([
                  ["Reviews · kept", state.data.digest.decisions.reviews.keep],
                  ["Reviews · tightened", state.data.digest.decisions.reviews.tighten],
                  ["Reviews · retired", state.data.digest.decisions.reviews.retire],
                  ["Snapshots frozen", state.data.digest.decisions.snapshotsFrozen],
                ]),
              ]}
              empty="No decision recorded."
            />
            <Rows
              id="digest-access"
              title="Access and duties"
              rows={pairs([
                ["Sign-ins", state.data.digest.access.signIns],
                ["MFA enrolments", state.data.digest.access.mfaEnrolled],
                ["All-sessions revocations", state.data.digest.access.sessionsRevoked],
                ["Duties granted", state.data.digest.access.granted],
                ["Duties revoked", state.data.digest.access.revoked],
                ["Control policy and location-hours changes", state.data.digest.access.policyChanges],
              ])}
              empty="No access events."
            />
            <Rows
              id="digest-alerts"
              title="Hard events"
              rows={pairs([
                ["After-hours holds", state.data.digest.alerts.afterHoursHolds],
                ["Hard events acknowledged", state.data.digest.alerts.hardEventsAcknowledged],
              ])}
              empty="No hard events."
            />
          </div>

          <Rows
            id="digest-chain"
            title={`Chain · ${state.data.digest.chain.events} event${state.data.digest.chain.events === 1 ? "" : "s"}${
              state.data.digest.chain.firstSeq !== null ? `, sequence ${state.data.digest.chain.firstSeq} to ${state.data.digest.chain.lastSeq}` : ""
            }`}
            rows={[...pairs([["Digest acknowledgments", state.data.digest.chain.acknowledgments]]), ...state.data.digest.chain.otherKinds]}
            empty="No other event kinds."
          />
          <p className="max-w-prose text-xs text-[var(--ink-3)]">{state.data.digest.scope}</p>
        </>
      )}
    </div>
  );
}
