import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import { ENTITLEMENTS } from "@pms/controls-engine";
import type { AfterHoursFacts } from "@pms/ledger";
import { approvalRequests, auditChainChecks, domainEvent, ledgerEntries, locations, reconciliationRuns, sessions, userEntitlements } from "@pms/db";
import type { AppDb } from "../db/client";
import { BACKDATE_DAYS, CRITICAL_DUTIES } from "../controls/detectors";
import { daysBetween } from "../controls/matchingMeasure";
import { formatCents, formatLedgerKind } from "../ledger/format";
import { hoursPhrase, isOutsideHours, localClock, WEEKDAY_LABEL, type Weekday, type WeekHours } from "../locations/hours";

export { isOutsideHours, localClock, WEEKDAYS, type Weekday, type WeekHours } from "../locations/hours";

/**
 * The seven hard events (docs/01 item 14; docs/10 decision 6): the only
 * signals that reach the owner one at a time rather than in the weekly
 * digest. after-hours refund, retroactive-dated entry, waived dual
 * control, deposit variance over threshold, audit-chain failure, new
 * device on a financial role, first posting into a sealed day. Each is read from rows the product already
 * holds, computed on every read, so it is immediate the moment the row
 * exists; no push channel exists yet, and the card on the owner board is
 * where they land. Sentences name a row, a location, a time, a duty, never
 * a person.
 */
export const HARD_EVENT_KINDS = [
  "after_hours_refund",
  "retroactive_entry",
  "waived_dual_control",
  "deposit_variance",
  "chain_failure",
  "new_device_financial_role",
  "sealed_day_posting",
] as const;
export type HardEventKind = (typeof HARD_EVENT_KINDS)[number];

export const HARD_EVENT_LABEL: Record<HardEventKind, string> = {
  after_hours_refund: "After-hours refund",
  retroactive_entry: "Retroactive-dated entry",
  waived_dual_control: "Dual control waived",
  deposit_variance: "Deposit variance over threshold",
  chain_failure: "Audit-chain check failed",
  new_device_financial_role: "New device on a financial role",
  sealed_day_posting: "First posting into a day already sealed",
};

/** How far back the card looks. */
export const HARD_EVENT_DAYS = 7;
/** A bank run whose variance against the practice's deposits exceeds this pages the owner. */
export const DEPOSIT_VARIANCE_THRESHOLD_CENTS = 10_000;

export const HARD_EVENT_ASSUMPTIONS = [
  `A deposit variance over ${formatCents(DEPOSIT_VARIANCE_THRESHOLD_CENTS)} pages the owner; the policy holds no variance threshold yet, so this figure is a constant, not a setting.`,
  "A device is the browser signature a session presents; a fingerprint or device enrolment does not exist yet.",
  "Business hours come from the location's stored week (default 7:00 to 19:00 Monday to Thursday, 7:00 to 17:00 Friday, closed weekends) and the server clock, never the browser.",
  "A first posting into a sealed day is read from the stamp the database wrote at insert time, never re-derived from dates; halves of a correction are left out, because a correction names the entry it replaces.",
];

export type HardEvent = {
  kind: HardEventKind;
  label: string;
  /** ISO timestamp the event happened. */
  at: string;
  subjectKind: string;
  subjectId: string;
  sentence: string;
  href: string | null;
  /**
   * The person the event is about, when the board can offer an act against
   * them (Increment 1.88). Only `new_device_financial_role` carries one: its
   * subject is the session, and ending a person's sign-ins needs the person.
   */
  personId?: string;
  /**
   * The event names the person reading it (Increment 1.89). `listHardEvents`
   * cannot know that — it has no viewer — so the alerts route decides it and
   * clears `personId` in the same breath: the act on this alarm is somebody
   * else's sessions, and your own are a sign-out rather than an ending.
   */
  aboutViewer?: boolean;
};

/**
 * How the after-hours refund ended (Increment 1.30): the hold ran and a
 * second person approved, the hold ran and still waits, or the row exists
 * with no approval at all, which the database trigger should have refused.
 */
export type AfterHoursOutcome = "approved" | "waiting" | "unheld";

export function afterHoursSentence(input: {
  amountCents: number;
  locationName: string;
  weekday: Weekday;
  date: string;
  hhmm: string;
  window: [string, string] | null;
  outcome?: AfterHoursOutcome;
}): string {
  const when = `${WEEKDAY_LABEL[input.weekday as Weekday] ?? input.weekday} ${input.date} at ${input.hhmm}`;
  const verb = input.outcome === "waiting" ? "is held, still waiting for a second person" : "was posted";
  const tail =
    input.outcome === "approved"
      ? " Held for a second person, who approved it."
      : input.outcome === "unheld"
        ? " Posted with no second person: the after-hours hold did not run on this row."
        : "";
  return `A ${formatCents(Math.abs(input.amountCents))} refund ${verb} on ${when} local time; ${hoursPhrase(input.locationName, input.window)}.${tail}`;
}

export type SessionRow = { id: string; userId: string; userAgent: string | null; createdAt: Date };

/**
 * Sessions that start from a browser signature the account has not
 * presented before, for holders of a critical duty, at or after `since`.
 * The first session an account ever has counts: it is a device not seen
 * before. Rows are read in time order, so a signature seen months ago is
 * known and does not page.
 */
export function newDeviceCandidates(rows: SessionRow[], holders: Set<string>, since: Date): SessionRow[] {
  const seen = new Set<string>();
  const out: SessionRow[] = [];
  for (const row of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const key = `${row.userId}|${row.userAgent ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.createdAt >= since && holders.has(row.userId)) out.push(row);
  }
  return out;
}

const ENTITLEMENT_LABEL = new Map(ENTITLEMENTS.map((e) => [e.id as string, e.label]));

export async function listHardEvents(db: AppDb, tenantId: string, opts: { since: Date; now?: Date }): Promise<HardEvent[]> {
  const since = opts.since;
  const out: HardEvent[] = [];

  // Where the money moved: after-hours refunds and retroactive-dated entries, from the ledger rows.
  const sites = await db
    .select({ id: locations.id, name: locations.name, timezone: locations.timezone, hours: locations.hours })
    .from(locations)
    .where(eq(locations.tenantId, tenantId));
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const entries = await db
    .select({
      id: ledgerEntries.id,
      kind: ledgerEntries.kind,
      amountCents: ledgerEntries.amountCents,
      effectiveDate: ledgerEntries.effectiveDate,
      postedAt: ledgerEntries.postedAt,
      locationId: ledgerEntries.locationId,
      approvalRequestId: ledgerEntries.approvalRequestId,
      closedDayId: ledgerEntries.closedDayId,
      correctsEntryId: ledgerEntries.correctsEntryId,
    })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.tenantId, tenantId), gte(ledgerEntries.postedAt, since)));
  for (const e of entries) {
    const postedOn = e.postedAt.toISOString().slice(0, 10);
    const daysBack = daysBetween(String(e.effectiveDate), postedOn);
    if (daysBack > BACKDATE_DAYS) {
      out.push({
        kind: "retroactive_entry",
        label: HARD_EVENT_LABEL.retroactive_entry,
        at: e.postedAt.toISOString(),
        subjectKind: "ledger_entry",
        subjectId: e.id,
        sentence: `A ${formatCents(Math.abs(Number(e.amountCents)))} ${formatLedgerKind(e.kind).toLowerCase()} effective ${String(e.effectiveDate)} was posted on ${postedOn}, ${daysBack} days after its effective date.`,
        href: "/ledger",
      });
    }
    // A first posting into a day the practice had already sealed (Increment 1.42).
    // The stamp is the database's own, written at insert time; a correction is
    // left out because it names the entry it replaces and arrives with a reason.
    if (e.closedDayId !== null && e.correctsEntryId === null) {
      out.push({
        kind: "sealed_day_posting",
        label: HARD_EVENT_LABEL.sealed_day_posting,
        at: e.postedAt.toISOString(),
        subjectKind: "ledger_entry",
        subjectId: e.id,
        sentence: `A ${formatCents(Math.abs(Number(e.amountCents)))} ${formatLedgerKind(e.kind).toLowerCase()} posted on ${postedOn} landed against ${String(e.effectiveDate)}, a day the practice had already sealed. The sealed figures do not move, so that day's count and that day's ledger now differ.`,
        href: "/day-close",
      });
    }
    if (e.kind === "refund") {
      const site = siteById.get(e.locationId);
      if (!site) continue;
      const clock = localClock(e.postedAt, site.timezone);
      const check = isOutsideHours((site.hours ?? {}) as WeekHours, clock.weekday, clock.hhmm);
      if (check.outside) {
        out.push({
          kind: "after_hours_refund",
          label: HARD_EVENT_LABEL.after_hours_refund,
          at: e.postedAt.toISOString(),
          subjectKind: "ledger_entry",
          subjectId: e.id,
          sentence: afterHoursSentence({
            amountCents: Number(e.amountCents),
            locationName: site.name,
            ...clock,
            window: check.window,
            outcome: e.approvalRequestId ? "approved" : "unheld",
          }),
          href: "/ledger",
        });
      }
    }
  }

  // A refund the after-hours hold caught and that still waits for a second person.
  const pending = await db
    .select({ id: approvalRequests.id, amountCents: approvalRequests.amountCents, heldPayload: approvalRequests.heldPayload, requestedAt: approvalRequests.requestedAt })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.tenantId, tenantId), eq(approvalRequests.status, "pending"), gte(approvalRequests.requestedAt, since)));
  for (const p of pending) {
    const held = p.heldPayload as { kind?: string; afterHours?: AfterHoursFacts | null };
    if (held.kind !== "refund" || !held.afterHours) continue;
    out.push({
      kind: "after_hours_refund",
      label: HARD_EVENT_LABEL.after_hours_refund,
      at: p.requestedAt.toISOString(),
      subjectKind: "approval_request",
      subjectId: p.id,
      sentence: afterHoursSentence({
        amountCents: Number(p.amountCents),
        locationName: held.afterHours.locationName,
        weekday: held.afterHours.weekday as Weekday,
        date: held.afterHours.date,
        hhmm: held.afterHours.hhmm,
        window: held.afterHours.window,
        outcome: "waiting",
      }),
      href: "/approvals",
    });
  }

  // A dual-control waiver, from the chain.
  const policyEvents = await db
    .select({ id: domainEvent.id, payload: domainEvent.payload, occurredAt: domainEvent.occurredAt })
    .from(domainEvent)
    .where(and(eq(domainEvent.tenantId, tenantId), eq(domainEvent.kind, "control.policy_changed"), gte(domainEvent.occurredAt, since)));
  for (const ev of policyEvents) {
    const p = ev.payload as { change?: string; action?: string; exceptionId?: string; channels?: string[]; effectiveTo?: string | null };
    if (p.change !== "exception_added" || p.action !== "waive_dual") continue;
    const channels = (p.channels ?? []).join(", ") || "a";
    out.push({
      kind: "waived_dual_control",
      label: HARD_EVENT_LABEL.waived_dual_control,
      at: ev.occurredAt.toISOString(),
      subjectKind: "policy_exception",
      subjectId: p.exceptionId ?? ev.id,
      sentence: `Dual control was waived on the ${channels} channel${(p.channels ?? []).length === 1 ? "" : "s"}${p.effectiveTo ? ` until ${p.effectiveTo}` : ", with no end date"}. A waiver never outlives 90 days.`,
      href: "/risk",
    });
  }

  // A bank run whose variance against the practice's deposits is over the threshold.
  const runs = await db
    .select({
      id: reconciliationRuns.id,
      periodStart: reconciliationRuns.periodStart,
      periodEnd: reconciliationRuns.periodEnd,
      varianceCents: reconciliationRuns.varianceCents,
      createdAt: reconciliationRuns.createdAt,
    })
    .from(reconciliationRuns)
    .where(and(eq(reconciliationRuns.tenantId, tenantId), gte(reconciliationRuns.createdAt, since)));
  for (const r of runs) {
    const variance = Number(r.varianceCents);
    if (Math.abs(variance) <= DEPOSIT_VARIANCE_THRESHOLD_CENTS) continue;
    out.push({
      kind: "deposit_variance",
      label: HARD_EVENT_LABEL.deposit_variance,
      at: r.createdAt.toISOString(),
      subjectKind: "reconciliation_run",
      subjectId: r.id,
      sentence: `The bank run for ${String(r.periodStart)} to ${String(r.periodEnd)} carries a ${formatCents(Math.abs(variance))} variance against the practice's deposits, over the ${formatCents(DEPOSIT_VARIANCE_THRESHOLD_CENTS)} threshold.`,
      href: `/reconciliation/${r.id}`,
    });
  }

  // The nightly chain check said no.
  const checks = await db
    .select({ day: auditChainChecks.day, checkedAt: auditChainChecks.checkedAt, eventCount: auditChainChecks.eventCount })
    .from(auditChainChecks)
    .where(and(eq(auditChainChecks.tenantId, tenantId), eq(auditChainChecks.ok, false), gte(auditChainChecks.checkedAt, since)));
  for (const c of checks) {
    out.push({
      kind: "chain_failure",
      label: HARD_EVENT_LABEL.chain_failure,
      at: c.checkedAt.toISOString(),
      subjectKind: "audit_chain_check",
      subjectId: String(c.day),
      sentence: `The chain check for ${String(c.day)} failed: ${c.eventCount} events did not verify against the recorded head. Treat every row since as unconfirmed until the verifier passes again.`,
      href: null,
    });
  }

  // A new device on a financial role: the first session from a browser signature, for a holder of a critical duty.
  const grants = await db
    .select({ userId: userEntitlements.userId, entitlement: userEntitlements.entitlement })
    .from(userEntitlements)
    .where(and(eq(userEntitlements.tenantId, tenantId), inArray(userEntitlements.entitlement, CRITICAL_DUTIES), isNull(userEntitlements.effectiveTo)));
  const dutiesByUser = new Map<string, string[]>();
  for (const g of grants) dutiesByUser.set(g.userId, [...(dutiesByUser.get(g.userId) ?? []), g.entitlement]);
  if (dutiesByUser.size > 0) {
    const rows = await db
      .select({ id: sessions.id, userId: sessions.userId, userAgent: sessions.userAgent, createdAt: sessions.createdAt })
      .from(sessions)
      .where(and(eq(sessions.tenantId, tenantId), inArray(sessions.userId, [...dutiesByUser.keys()])));
    for (const s of newDeviceCandidates(rows, new Set(dutiesByUser.keys()), since)) {
      const duties = (dutiesByUser.get(s.userId) ?? []).map((d) => ENTITLEMENT_LABEL.get(d) ?? d).sort();
      out.push({
        kind: "new_device_financial_role",
        label: HARD_EVENT_LABEL.new_device_financial_role,
        at: s.createdAt.toISOString(),
        subjectKind: "session",
        subjectId: s.id,
        sentence: `A holder of ${duties.join(" and ")} signed in from a browser not seen before for that account, at ${s.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC.`,
        /**
         * No link (Increment 1.88). This pointed at Practice Risk, which
         * renders no hard events and carried nothing to do about this one — a
         * link out of the board and away from the alarm. The act now sits
         * beside the alarm instead, so there is nowhere else to send anybody.
         */
        href: null,
        personId: s.userId,
      });
    }
  }

  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function countByKind(items: HardEvent[]): Record<HardEventKind, number> {
  const counts = Object.fromEntries(HARD_EVENT_KINDS.map((k) => [k, 0])) as Record<HardEventKind, number>;
  for (const i of items) counts[i.kind] += 1;
  return counts;
}
