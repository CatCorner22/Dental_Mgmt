"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isRole, meetsRole } from "@/lib/auth/roles";
import { formatCents } from "@/lib/ledger/format";
import type { OwnerBoard as Board, TileShape } from "@/lib/home/board";

type Me = { ok: boolean; role?: string };

type LoadState =
  | { status: "loading" }
  | { status: "not_for_seat" }
  | { status: "error"; message: string }
  | { status: "ready"; board: Board };

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">{title}</p>
      {children}
    </div>
  );
}

export function OwnerBoard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

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
      const res = await fetch("/api/home/board");
      const body = (await res.json().catch(() => ({}))) as Board & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not load the board.");
      if (!cancelled) setState({ status: "ready", board: body });
    })().catch((err: unknown) => {
      if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Could not load the board." });
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Approvals only you can give">
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

        <Card title="Decisions due for review">
          <p className="mt-1 text-2xl font-semibold tabular-nums">{b.decisionsDue.length}</p>
          {b.decisionsDue.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--ink-2)]">No control decision comes up for review in the next 30 days.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-[var(--ink-2)]">
              {b.decisionsDue.slice(0, 3).map((d) => (
                <li key={d.id}>
                  {d.kindLabel} on {d.subjectId} · {d.overdue ? `review was due ${d.reviewBy}` : `review by ${d.reviewBy}`}
                </li>
              ))}
              {b.decisionsDue.length > 3 && <li>and {b.decisionsDue.length - 3} more</li>}
            </ul>
          )}
          <p className="mt-1 text-sm">
            <Link className="font-semibold text-[var(--link)] underline-offset-2 hover:underline" href="/risk">
              Review on Practice Risk
            </Link>
          </p>
        </Card>

        <Card title="Exceptions expiring">
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

        <Card title="Practice health">
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
