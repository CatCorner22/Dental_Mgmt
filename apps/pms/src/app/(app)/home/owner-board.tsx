"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isRole, meetsRole } from "@/lib/auth/roles";
import { formatCents } from "@/lib/ledger/format";
import type { OwnerBoard as Board, TileShape } from "@/lib/home/board";

type Me = { ok: boolean; role?: string };

type HardEventItem = {
  kind: string;
  label: string;
  at: string;
  subjectKind: string;
  subjectId: string;
  sentence: string;
  href: string | null;
  /** The owner's acknowledgment, if recorded (Increment 1.33). */
  ack: { acknowledgedByName: string; acknowledgedAt: string; note: string } | null;
};
type Alerts = {
  since: string;
  days: number;
  items: HardEventItem[];
  acknowledgments: { total: number; acknowledged: number; waiting: number };
  assumptions: string[];
};

type LoadState =
  | { status: "loading" }
  | { status: "not_for_seat" }
  | { status: "error"; message: string }
  | { status: "ready"; board: Board; isAdmin: boolean; alerts: Alerts | null };

type ReviewAction = "keep" | "tighten" | "retire";

/** One shape, readable in grayscale; the words beside it carry the meaning. */
function Shape({ shape }: { shape: TileShape }) {
  const common = { width: 40, height: 40, viewBox: "0 0 40 40", "aria-hidden": true, className: "shrink-0" } as const;
  if (shape === "filled") {
    return (
      <svg {...common}>
        <circle cx="20" cy="20" r="17" fill="currentColor" />
      </svg>
    );
  }
  if (shape === "half") {
    return (
      <svg {...common}>
        <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M20 3 A17 17 0 0 1 20 37 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 4 L37 35 L3 35 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <p id={id} className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
        {title}
      </p>
      {children}
    </section>
  );
}

async function loadBoard(): Promise<Board> {
  const res = await fetch("/api/home/board");
  const body = (await res.json().catch(() => ({}))) as Board & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not load the board.");
  return body;
}

/** The six hard events are the owner's alone; the manager seat sees no card. */
async function loadAlerts(isAdmin: boolean): Promise<Alerts | null> {
  if (!isAdmin) return null;
  const res = await fetch("/api/alerts");
  const body = (await res.json().catch(() => ({}))) as Alerts & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not load the hard events.");
  return body;
}

export function OwnerBoard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // The review being composed: which decision, which action, and the note so far.
  const [review, setReview] = useState<{ id: string; action: ReviewAction; note: string } | null>(null);
  // The hard event being acknowledged: its key and the note so far.
  const [acking, setAcking] = useState<{ key: string; note: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meRes = await fetch("/api/me");
      const me = (await meRes.json().catch(() => ({ ok: false }))) as Me;
      const role = me.role && isRole(me.role) ? me.role : undefined;
      if (!meRes.ok || !meetsRole(role, "manager")) {
        if (!cancelled) setState({ status: "not_for_seat" });
        return;
      }
      const isAdmin = meetsRole(role, "admin");
      const [board, alerts] = await Promise.all([loadBoard(), loadAlerts(isAdmin)]);
      if (!cancelled) setState({ status: "ready", board, isAdmin, alerts });
    })().catch((err: unknown) => {
      if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Could not load the board." });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** One superseding row per review; the board is re-read from rows afterwards. */
  async function submitReview(id: string, action: ReviewAction, note: string) {
    if (state.status !== "ready") return;
    setBusy(id);
    setMessage(null);
    try {
      const res = await fetch("/api/controls/decisions/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisionId: id, action, note: note || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { sentence?: string; error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      setReview(null);
      setState({ ...state, board: await loadBoard() });
      setMessage(body.sentence ?? "Review recorded.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "The review was not recorded.");
    } finally {
      setBusy(null);
    }
  }

  /** One append-only acknowledgment; the card is re-read from rows afterwards. */
  async function acknowledge(item: HardEventItem, note: string) {
    if (state.status !== "ready") return;
    const key = `${item.kind}|${item.subjectKind}|${item.subjectId}`;
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch("/api/alerts/ack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: item.kind, subjectKind: item.subjectKind, subjectId: item.subjectId, note }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      setAcking(null);
      setState({ ...state, alerts: await loadAlerts(state.isAdmin) });
      setMessage(`Acknowledged: ${item.label}. The note is on the chain beside it.`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "The hard event was not acknowledged.");
    } finally {
      setBusy(null);
    }
  }

  if (state.status === "loading") return <p className="text-sm text-[var(--ink-2)]">Reading yesterday's rows…</p>;
  if (state.status === "not_for_seat") {
    return (
      <p className="max-w-prose text-[var(--ink-2)]">
        The board is for the manager and owner seats. Your seat works from the links below.
      </p>
    );
  }
  if (state.status === "error") return <p className="text-sm text-[var(--ink-2)]">{state.message}</p>;

  const b = state.board;
  const lag = b.matching.medianLagDays;
  return (
    <div className="grid gap-4">
      {message && (
        <p className="text-sm text-[var(--ink-2)]" aria-live="polite">
          {message}
        </p>
      )}
      <section
        aria-labelledby="yesterday"
        className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Yesterday reconciled? · {b.yesterday.businessDate}</p>
        <div className="mt-2 flex items-center gap-4 text-[var(--ink)]">
          <Shape shape={b.yesterday.shape} />
          <h2 id="yesterday" className="text-2xl font-semibold">
            {b.yesterday.headline}
          </h2>
        </div>
        <p className="mt-3 max-w-prose text-sm text-[var(--ink-2)]">{b.yesterday.why}</p>
        {b.yesterday.action && (
          <Link
            className="mt-4 inline-flex min-h-[var(--target)] items-center rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold text-[var(--ink)]"
            href={b.yesterday.action.href}
          >
            {b.yesterday.action.label}
          </Link>
        )}
        <p className="mt-3 text-sm text-[var(--ink-2)]">
          Bank matching:{" "}
          {b.matching.matchRate48hPct === null ? "no rate yet" : `${b.matching.matchRate48hPct}% within 48 hours`}
          {lag === null ? "" : ` · detection lag ${lag} ${lag === 1 ? "day" : "days"} (median)`}. Measured over the last{" "}
          {b.matching.windowDays} days from the bank lines the practice holds.
        </p>
      </section>

      {b.afterHoursHold && !b.afterHoursHold.on && (
        <section aria-labelledby="after-hours-hold" className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-4">
          <p id="after-hours-hold" className="font-semibold text-[var(--ink)]">
            After-hours hold: off since {b.afterHoursHold.offSince ?? "an unrecorded date"},{" "}
            {b.afterHoursHold.reviewDue
              ? `review ${b.afterHoursHold.overdue ? "was due" : "due"} ${b.afterHoursHold.reviewDue}`
              : "no review date recorded"}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            {b.afterHoursHold.why
              ? `Decided by ${b.afterHoursHold.decidedByName}: ${b.afterHoursHold.why} `
              : "An evening refund, adjustment, or write-off posts with no second person while this is off. "}
            <Link className="font-semibold text-[var(--link)] underline-offset-2 hover:underline" href="/risk">
              Switch it back on
            </Link>
          </p>
        </section>
      )}

      {state.alerts && (
        <Card id="hard-events" title={`Hard events · last ${state.alerts.days} days`}>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{state.alerts.items.length}</p>
          {state.alerts.acknowledgments.waiting > 0 && (
            <p className="text-sm text-[var(--ink-2)]">
              {state.alerts.acknowledgments.waiting} not yet acknowledged. Each one takes a note of what was done.
            </p>
          )}
          {state.alerts.items.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--ink-2)]">
              None. The six that page you one at a time: an after-hours refund, a retroactive-dated entry, a waived dual control, a
              deposit variance over threshold, a failed chain check, a new device on a financial role. Everything else waits for
              the weekly digest.
            </p>
          ) : (
            <ul className="mt-1 space-y-2 text-sm text-[var(--ink-2)]">
              {state.alerts.items.map((e) => {
                const key = `${e.kind}|${e.subjectKind}|${e.subjectId}`;
                const composing = acking?.key === key ? acking : null;
                const noteOk = (composing?.note.trim().length ?? 0) >= 10;
                return (
                  <li key={key}>
                    <p className="font-semibold text-[var(--ink)]">
                      {e.label} · {new Date(e.at).toLocaleString()}
                    </p>
                    <p>
                      {e.sentence}
                      {e.href && (
                        <>
                          {" "}
                          <Link className="font-semibold text-[var(--link)] underline-offset-2 hover:underline" href={e.href}>
                            Open
                          </Link>
                        </>
                      )}
                    </p>
                    {e.ack ? (
                      <p className="text-xs text-[var(--ink-3)]">
                        Seen by {e.ack.acknowledgedByName} on {e.ack.acknowledgedAt.slice(0, 10)}: {e.ack.note}
                      </p>
                    ) : composing ? (
                      <form
                        className="mt-1 flex flex-wrap items-end gap-2"
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          if (noteOk) void acknowledge(e, composing.note.trim());
                        }}
                      >
                        <label className="flex min-w-[14rem] flex-1 flex-col text-sm">
                          <span className="mb-1 font-semibold text-[var(--ink-2)]">What was done about it (at least ten characters)</span>
                          <input
                            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                            value={composing.note}
                            onChange={(ev) => setAcking({ key, note: ev.target.value })}
                          />
                        </label>
                        <button
                          type="submit"
                          className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
                          disabled={busy !== null || !noteOk}
                        >
                          {busy === key ? "Recording…" : "Mark as seen"}
                        </button>
                        <button
                          type="button"
                          className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-sm font-semibold text-[var(--ink)]"
                          onClick={() => setAcking(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="mt-1 min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                        disabled={busy !== null}
                        aria-label={`Acknowledge ${e.label}`}
                        onClick={() => setAcking({ key, note: "" })}
                      >
                        Acknowledge
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-[var(--ink-3)]">{state.alerts.assumptions.join(" ")}</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card id="approvals-card" title="Approvals only you can give">
          <p className="mt-1 text-2xl font-semibold tabular-nums">{b.approvals.waiting}</p>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            {b.approvals.waiting === 0
              ? "Nothing is waiting on you."
              : `${formatCents(b.approvals.totalCents)} held until a second person decides.`}{" "}
            <Link className="font-semibold text-[var(--link)] underline-offset-2 hover:underline" href="/approvals">
              Open the inbox
            </Link>
          </p>
        </Card>

        <Card id="decisions-due" title="Decisions due for review">
          <p className="mt-1 text-2xl font-semibold tabular-nums">{b.decisionsDue.length}</p>
          {b.decisionsDue.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--ink-2)]">No control decision comes up for review in the next 30 days.</p>
          ) : (
            <ul className="mt-1 space-y-3 text-sm text-[var(--ink-2)]">
              {b.decisionsDue.slice(0, 3).map((d) => {
                const composing = review?.id === d.id ? review : null;
                const noteOk = (composing?.note.trim().length ?? 0) >= 10;
                return (
                  <li key={d.id} className="border-t border-[var(--line)] pt-2 first:border-0 first:pt-0">
                    <p className="font-semibold text-[var(--ink)]">
                      {d.kindLabel} on {d.subjectKind.replace(/_/g, " ")} · {d.overdue ? `review was due ${d.reviewBy}` : `review by ${d.reviewBy}`}
                    </p>
                    <p className="text-xs text-[var(--ink-3)]" title={d.subjectId}>
                      Why, when decided: {d.note}
                    </p>
                    {d.effect && <p className="mt-1">{d.effect}</p>}
                    {state.isAdmin && !composing && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
                          disabled={busy !== null}
                          onClick={() => void submitReview(d.id, "keep", "")}
                          aria-label={`Keep ${d.kindLabel} 90 more days`}
                        >
                          {busy === d.id ? "Recording…" : "Keep 90 more days"}
                        </button>
                        <button
                          type="button"
                          className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
                          disabled={busy !== null}
                          onClick={() => setReview({ id: d.id, action: "tighten", note: "" })}
                          aria-label={`Tighten ${d.kindLabel}`}
                        >
                          Tighten
                        </button>
                        <button
                          type="button"
                          className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
                          disabled={busy !== null}
                          onClick={() => setReview({ id: d.id, action: "retire", note: "" })}
                          aria-label={`Retire ${d.kindLabel}`}
                        >
                          Retire
                        </button>
                      </div>
                    )}
                    {composing && (
                      <form
                        className="mt-2 flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (noteOk) void submitReview(d.id, composing.action, composing.note.trim());
                        }}
                      >
                        <label className="flex min-w-[14rem] flex-1 flex-col text-sm">
                          <span className="mb-1 font-semibold text-[var(--ink-2)]">
                            {composing.action === "tighten"
                              ? "What tightens (at least ten characters). The decision becomes Remediate, reviewed in 30 days."
                              : "Why it ends (at least ten characters). Retiring cannot be undone; the subject reads as undecided again."}
                          </span>
                          <input
                            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                            value={composing.note}
                            onChange={(e) => setReview({ ...composing, note: e.target.value })}
                          />
                        </label>
                        <button
                          type="submit"
                          className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
                          disabled={busy !== null || !noteOk}
                        >
                          {busy === d.id ? "Recording…" : composing.action === "tighten" ? "Tighten with this note" : "Retire for good"}
                        </button>
                        <button
                          type="button"
                          className="min-h-[var(--target)] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-sm font-semibold text-[var(--ink)]"
                          onClick={() => setReview(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
              {b.decisionsDue.length > 3 && <li>and {b.decisionsDue.length - 3} more</li>}
            </ul>
          )}
          <p className="mt-1 text-sm">
            <Link className="font-semibold text-[var(--link)] underline-offset-2 hover:underline" href="/risk">
              Review on Practice Risk
            </Link>
          </p>
        </Card>

        <Card id="exceptions-expiring" title="Exceptions expiring">
          <p className="mt-1 text-2xl font-semibold tabular-nums">{b.expiringExceptions.length}</p>
          {b.expiringExceptions.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--ink-2)]">No standing exception ends in the next 14 days.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-[var(--ink-2)]">
              {b.expiringExceptions.slice(0, 3).map((e) => (
                <li key={e.id}>
                  {e.label} · ends {e.effectiveTo} ({e.daysLeft === 0 ? "today" : `${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"}`})
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card id="practice-health" title="Practice health">
          <p className="mt-1 text-2xl font-semibold tabular-nums">{b.health.segregationHealth} / 100</p>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Segregation health. COSO overall {b.health.cosoOverall}. {b.health.openConflicts} open duty combination
            {b.health.openConflicts === 1 ? "" : "s"}, {b.health.conflictsWithoutDecision} without a decision,{" "}
            {b.health.unmitigatedCritical} critical unmitigated. {b.detectorFindingsOpen} detector finding
            {b.detectorFindingsOpen === 1 ? "" : "s"} open as of the last frozen snapshot, {b.detectorFindingsUndecided} without a
            decision.
          </p>
          {b.health.levers.length > 0 && (
            <p className="mt-1 text-sm text-[var(--ink-2)]">
              What would help most: {b.health.levers.map((l) => `${l.label} (−${l.delta})`).join("; ")}. Directional until a CPA
              calibrates the weights.
            </p>
          )}
        </Card>
      </div>
      <p className="text-xs text-[var(--ink-3)]">
        Computed from live rows at {new Date(b.computedAt).toLocaleString()}. Nothing on this board ranks a person.
      </p>
    </div>
  );
}
