import { createHash } from "node:crypto";
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { DECISION_KIND_LABEL, isIsoDate, overdueReviews, type ControlDecision } from "@pms/controls-engine";
import { approvalRequests, bankStatementImports, controlFindings, deposits, digestAcks, domainEvent, ledgerEntries, reconciliationRuns, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { listDecisions } from "../controls/decisions";
import { FINDING_KIND_LABEL, LEDGER_RELEASE_CHANNEL } from "../controls/detectors";
import { appendControlEvent } from "../controls/events";
import { formatLedgerKind } from "../ledger/format";

/**
 * The weekly digest (docs/01 items 13 and 14; docs/05 "batched weekly,
 * minimum sample sizes, systemic-share re-scoping"). Seven days of the
 * practice's counts, computed from rows on every read: what the ledger
 * took, what needed a second person, what the bank confirmed, what the
 * detectors opened and closed, what the owner decided, who signed in and
 * what duties moved, and how far the chain grew. Every count is the
 * practice's; the query layer has no person dimension, so no row can name
 * anyone. Batched, never alerting.
 *
 * The owner stamps a period as read (docs/03 `digest_acks`): one row per
 * period end that binds a hash of the digest they read, so a later reader
 * can tell whether the digest changed after it was acknowledged.
 */
export const DIGEST_DAYS = 7;

export type DigestPeriod = {
  /** First calendar day, inclusive (YYYY-MM-DD). */
  start: string;
  /** Last calendar day, inclusive (YYYY-MM-DD). */
  end: string;
  days: number;
  /** UTC midnight at the start of `start`. */
  startAt: Date;
  /** UTC midnight after `end`: exclusive. */
  endAt: Date;
};

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The seven calendar days ending on `end`, inclusive. */
export function periodEnding(end: string, days: number = DIGEST_DAYS): DigestPeriod {
  if (!isIsoDate(end)) throw new Error(`Not a calendar date: ${end}`);
  const start = shiftDate(end, -(days - 1));
  return { start, end, days, startAt: new Date(`${start}T00:00:00Z`), endAt: new Date(`${shiftDate(end, 1)}T00:00:00Z`) };
}

export type CountRow = { key: string; label: string; count: number; cents?: number };

export type WeeklyDigest = {
  period: { start: string; end: string; days: number };
  money: {
    postings: CountRow[];
    postingCount: number;
    guardedWithSecond: number;
    guardedWithoutSecond: number;
  };
  approvals: { requested: number; given: number; declined: number; cancelled: number };
  bank: {
    statementsImported: number;
    runsCleared: number;
    runsOwnerOnly: number;
    variancesClearedWithReason: number;
    depositsPrepared: number;
    dayClosesFrozen: number;
    /** Rows that landed behind a seal this week, and how many are first postings (Increment 1.43). */
    postingsIntoSealedDays: number;
    firstPostingsIntoSealedDays: number;
    statementsIssued: number;
    statementsHeld: number;
    statementsVoided: number;
  };
  findings: { opened: CountRow[]; closed: CountRow[]; openNow: number };
  decisions: {
    recorded: CountRow[];
    reviews: { keep: number; tighten: number; retire: number };
    overdueNow: number;
    snapshotsFrozen: number;
  };
  access: { signIns: number; mfaEnrolled: number; sessionsRevoked: number; granted: number; revoked: number; policyChanges: number };
  /**
   * The week's hard events (Increment 1.33): postings the after-hours hold caught,
   * and events the owner acknowledged. Since Increment 1.53 it also counts the
   * channels somebody attested this week -- a fact about the week, which is the
   * only kind of figure this object may carry, because the month-end package
   * folds the digest in whole and hashes it.
   */
  alerts: { afterHoursHolds: number; hardEventsAcknowledged: number; channelsAttested: number };
  chain: { events: number; firstSeq: number | null; lastSeq: number | null; acknowledgments: number; otherKinds: CountRow[] };
  /** The sentence that says what these numbers are and are not. */
  scope: string;
};

export const SCOPE_SENTENCE =
  "Every count is the practice's over these seven days. The queries carry no person dimension, so no row here names anyone; rates are not shown because a week is too small a sample to grade.";

/** Chain event kinds the named fields consume; anything else is listed under the chain. */
const EVENT_FIELDS: Record<string, string> = {
  "approval.requested": "approvals.requested",
  "approval.decided": "approvals.given",
  "approval.declined": "approvals.declined",
  "approval.cancelled": "approvals.cancelled",
  "reconciliation.variance_cleared": "bank.variancesClearedWithReason",
  "day_close.frozen": "bank.dayClosesFrozen",
  "statement.issued": "bank.statementsIssued",
  "statement.held": "bank.statementsHeld",
  "statement.voided": "bank.statementsVoided",
  "control.snapshot": "decisions.snapshotsFrozen",
  "auth.signin": "access.signIns",
  "auth.mfa_enrolled": "access.mfaEnrolled",
  "auth.sessions_revoked_all": "access.sessionsRevoked",
  "role.granted": "access.granted",
  "role.revoked": "access.revoked",
  "control.policy_changed": "access.policyChanges",
  /** A location's business hours moved (Increment 1.32): the after-hours hold's window changed with them. */
  "location.hours_changed": "access.policyChanges",
  "digest.acknowledged": "chain.acknowledgments",
  "hard_event.acknowledged": "alerts.hardEventsAcknowledged",
  /** Somebody vouched for a channel the product cannot enforce (Increment 1.53). */
  "control.channel_attested": "alerts.channelsAttested",
};

/** Kinds counted from their own tables or from the chain but shown elsewhere; not listed twice. */
const EVENT_KINDS_SHOWN_ELSEWHERE = new Set(["reconciliation.cleared", "control.decision", "statement.drafted", "deposit.staged_applied", "control.release_attested"]);

export const EVENT_LABEL: Record<string, string> = {
  "reconciliation.cleared": "Bank run cleared",
  "control.decision": "Control decision recorded",
  "statement.drafted": "Statement drafted",
  "deposit.staged_applied": "Staged deposit applied",
  "control.release_attested": "Release attested",
  "import.applied": "Import applied",
  "cpa.package_exported": "CPA month-end package exported",
  "gl_mapping.proposed": "GL mapping proposed",
  "gl_mapping.decided": "GL mapping decided",
  "month.closed": "Month closed for the accountant",
};

export function eventLabel(kind: string): string {
  return EVENT_LABEL[kind] ?? kind.replace(/[._]/g, " ");
}

function setPath(target: Record<string, unknown>, path: string, count: number): void {
  const [group, field] = path.split(".") as [string, string];
  (target[group] as Record<string, number>)[field] = count;
}

/** Computes the digest for the period; the same rows always give the same digest. */
export async function computeDigest(db: AppDb, tenantId: string, period: DigestPeriod): Promise<WeeklyDigest> {
  /** This tenant's rows whose timestamp column falls inside the period. */
  const inWindow = (table: { tenantId: AnyPgColumn }, column: AnyPgColumn) =>
    and(eq(table.tenantId, tenantId), gte(column, period.startAt), lt(column, period.endAt));

  const digest: WeeklyDigest = {
    period: { start: period.start, end: period.end, days: period.days },
    money: { postings: [], postingCount: 0, guardedWithSecond: 0, guardedWithoutSecond: 0 },
    approvals: { requested: 0, given: 0, declined: 0, cancelled: 0 },
    bank: {
      statementsImported: 0,
      runsCleared: 0,
      runsOwnerOnly: 0,
      variancesClearedWithReason: 0,
      depositsPrepared: 0,
      dayClosesFrozen: 0,
      postingsIntoSealedDays: 0,
      firstPostingsIntoSealedDays: 0,
      statementsIssued: 0,
      statementsHeld: 0,
      statementsVoided: 0,
    },
    findings: { opened: [], closed: [], openNow: 0 },
    decisions: { recorded: [], reviews: { keep: 0, tighten: 0, retire: 0 }, overdueNow: 0, snapshotsFrozen: 0 },
    access: { signIns: 0, mfaEnrolled: 0, sessionsRevoked: 0, granted: 0, revoked: 0, policyChanges: 0 },
    alerts: { afterHoursHolds: 0, hardEventsAcknowledged: 0, channelsAttested: 0 },
    chain: { events: 0, firstSeq: null, lastSeq: null, acknowledgments: 0, otherKinds: [] },
    scope: SCOPE_SENTENCE,
  };

  // Money, from the ledger rows themselves.
  const postings = await db
    .select({ kind: ledgerEntries.kind, n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::bigint` })
    .from(ledgerEntries)
    .where(inWindow(ledgerEntries, ledgerEntries.postedAt))
    .groupBy(ledgerEntries.kind)
    .orderBy(ledgerEntries.kind);
  digest.money.postings = postings.map((p) => ({ key: p.kind, label: formatLedgerKind(p.kind), count: Number(p.n), cents: Number(p.cents) }));
  digest.money.postingCount = digest.money.postings.reduce((n, p) => n + p.count, 0);
  const guardedKinds = Object.keys(LEDGER_RELEASE_CHANNEL);
  const [withSecond] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(and(inWindow(ledgerEntries, ledgerEntries.postedAt), inArray(ledgerEntries.kind, guardedKinds), isNotNull(ledgerEntries.approvalRequestId)));
  const [withoutSecond] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(and(inWindow(ledgerEntries, ledgerEntries.postedAt), inArray(ledgerEntries.kind, guardedKinds), isNull(ledgerEntries.approvalRequestId)));
  digest.money.guardedWithSecond = Number(withSecond?.n ?? 0);

  // Postings the after-hours hold caught this week, whatever became of them (Increment 1.33).
  const [afterHours] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(approvalRequests)
    .where(and(inWindow(approvalRequests, approvalRequests.requestedAt), sql`${approvalRequests.heldPayload} -> 'afterHours' IS NOT NULL`));
  digest.alerts.afterHoursHolds = Number(afterHours?.n ?? 0);

  // Rows that landed behind a day the practice had already sealed, from the stamps
  // the database wrote at insert time (Increment 1.43). The split is the point: a
  // correction names the entry it replaces, and a first posting names nothing.
  // Adding these moved the package hash, which is why PACKAGE_SCHEMA_VERSION is v2.
  const [sealed] = await db
    .select({
      n: sql<number>`count(*)::int`,
      first: sql<number>`count(*) FILTER (WHERE ${ledgerEntries.correctsEntryId} IS NULL)::int`,
    })
    .from(ledgerEntries)
    .where(and(inWindow(ledgerEntries, ledgerEntries.postedAt), eq(ledgerEntries.postedAfterClose, true)));
  digest.bank.postingsIntoSealedDays = Number(sealed?.n ?? 0);
  digest.bank.firstPostingsIntoSealedDays = Number(sealed?.first ?? 0);
  digest.money.guardedWithoutSecond = Number(withoutSecond?.n ?? 0);

  // Bank and close, from their tables.
  const [imports] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bankStatementImports)
    .where(inWindow(bankStatementImports, bankStatementImports.createdAt));
  digest.bank.statementsImported = Number(imports?.n ?? 0);
  const runs = await db
    .select({ summary: reconciliationRuns.summary })
    .from(reconciliationRuns)
    .where(and(inWindow(reconciliationRuns, reconciliationRuns.clearedAt), eq(reconciliationRuns.status, "cleared")));
  digest.bank.runsCleared = runs.length;
  digest.bank.runsOwnerOnly = runs.filter((r) => (r.summary as { degradedOwnerClearance?: boolean }).degradedOwnerClearance === true).length;
  const [prepared] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(deposits)
    .where(inWindow(deposits, deposits.createdAt));
  digest.bank.depositsPrepared = Number(prepared?.n ?? 0);

  // Detector findings: opened and closed in the window, and open at the end of it.
  const opened = await db
    .select({ kind: controlFindings.kind, n: sql<number>`count(*)::int` })
    .from(controlFindings)
    .where(inWindow(controlFindings, controlFindings.firstSeenAt))
    .groupBy(controlFindings.kind)
    .orderBy(controlFindings.kind);
  digest.findings.opened = opened.map((r) => ({ key: r.kind, label: FINDING_KIND_LABEL[r.kind] ?? r.kind.replace(/_/g, " "), count: Number(r.n) }));
  const closed = await db
    .select({ kind: controlFindings.kind, n: sql<number>`count(*)::int` })
    .from(controlFindings)
    .where(inWindow(controlFindings, controlFindings.closedAt))
    .groupBy(controlFindings.kind)
    .orderBy(controlFindings.kind);
  digest.findings.closed = closed.map((r) => ({ key: r.kind, label: FINDING_KIND_LABEL[r.kind] ?? r.kind.replace(/_/g, " "), count: Number(r.n) }));
  const [openNow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(controlFindings)
    .where(and(eq(controlFindings.tenantId, tenantId), eq(controlFindings.status, "open"), lt(controlFindings.firstSeenAt, period.endAt)));
  digest.findings.openNow = Number(openNow?.n ?? 0);

  // Decisions: recorded in the window by kind; overdue as of the period's end.
  const decisions: ControlDecision[] = await listDecisions(db, tenantId);
  const recorded = new Map<string, number>();
  for (const d of decisions) {
    if (d.decidedAt >= period.startAt.toISOString() && d.decidedAt < period.endAt.toISOString()) {
      recorded.set(d.kind, (recorded.get(d.kind) ?? 0) + 1);
    }
  }
  digest.decisions.recorded = [...recorded.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([kind, count]) => ({ key: kind, label: DECISION_KIND_LABEL[kind as ControlDecision["kind"]] ?? kind, count }));
  digest.decisions.overdueNow = overdueReviews(
    decisions.filter((d) => d.decidedAt < period.endAt.toISOString()),
    period.end
  ).length;
  const reviews = await db
    .select({ action: sql<string>`${domainEvent.payload}->>'reviewAction'`, n: sql<number>`count(*)::int` })
    .from(domainEvent)
    .where(and(inWindow(domainEvent, domainEvent.occurredAt), eq(domainEvent.kind, "control.decision"), sql`${domainEvent.payload}->>'reviewAction' is not null`))
    .groupBy(sql`${domainEvent.payload}->>'reviewAction'`);
  for (const r of reviews) {
    if (r.action === "keep" || r.action === "tighten" || r.action === "retire") digest.decisions.reviews[r.action] = Number(r.n);
  }

  // The chain: every event in the window, by kind.
  const events = await db
    .select({ kind: domainEvent.kind, n: sql<number>`count(*)::int`, first: sql<number>`min(${domainEvent.seq})::bigint`, last: sql<number>`max(${domainEvent.seq})::bigint` })
    .from(domainEvent)
    .where(inWindow(domainEvent, domainEvent.occurredAt))
    .groupBy(domainEvent.kind)
    .orderBy(domainEvent.kind);
  for (const e of events) {
    const count = Number(e.n);
    digest.chain.events += count;
    digest.chain.firstSeq = digest.chain.firstSeq === null ? Number(e.first) : Math.min(digest.chain.firstSeq, Number(e.first));
    digest.chain.lastSeq = digest.chain.lastSeq === null ? Number(e.last) : Math.max(digest.chain.lastSeq, Number(e.last));
    const field = EVENT_FIELDS[e.kind];
    if (field) setPath(digest as unknown as Record<string, unknown>, field, count);
    else if (!EVENT_KINDS_SHOWN_ELSEWHERE.has(e.kind)) digest.chain.otherKinds.push({ key: e.kind, label: eventLabel(e.kind), count });
  }

  return digest;
}

/** JSON with sorted keys at every level, so the same digest always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function digestHash(digest: WeeklyDigest): string {
  return createHash("sha256").update(canonicalJson(digest)).digest("hex");
}

export type DigestAck = {
  id: string;
  periodStart: string;
  periodEnd: string;
  summaryHash: string;
  eventCount: number;
  acknowledgedById: string;
  acknowledgedByName: string;
  acknowledgedAt: string;
};

function mapAck(row: typeof digestAcks.$inferSelect): DigestAck {
  return {
    id: row.id,
    periodStart: String(row.periodStart),
    periodEnd: String(row.periodEnd),
    summaryHash: row.summaryHash,
    eventCount: row.eventCount,
    acknowledgedById: row.acknowledgedById,
    acknowledgedByName: row.acknowledgedByName,
    acknowledgedAt: row.acknowledgedAt.toISOString(),
  };
}

export async function loadDigestAck(db: AppDb, tenantId: string, periodEnd: string): Promise<DigestAck | null> {
  const rows = await db
    .select()
    .from(digestAcks)
    .where(and(eq(digestAcks.tenantId, tenantId), eq(digestAcks.periodEnd, periodEnd)));
  return rows[0] ? mapAck(rows[0]) : null;
}

export type AcknowledgeResult =
  | { ok: true; ack: DigestAck }
  | { ok: false; status: 400 | 409; errors: string[] };

/**
 * Stamps a period as read. Refuses a period that has not ended, a period
 * already acknowledged, and a hash that no longer matches what the rows
 * say: the owner acknowledges the digest they read, not the one that
 * exists now. The stamp is one append-only row and one chain event.
 */
export async function acknowledgeDigest(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; ending: string; summaryHash: string; now?: Date }
): Promise<AcknowledgeResult> {
  const now = input.now ?? new Date();
  if (!isIsoDate(input.ending)) return { ok: false, status: 400, errors: ["The period end must be a calendar date (YYYY-MM-DD)."] };
  if (input.ending > now.toISOString().slice(0, 10)) {
    return { ok: false, status: 400, errors: ["A week that has not ended yet cannot be acknowledged."] };
  }
  const existing = await loadDigestAck(db, input.tenantId, input.ending);
  if (existing) {
    return {
      ok: false,
      status: 409,
      errors: [`This week was already acknowledged by ${existing.acknowledgedByName} on ${existing.acknowledgedAt.slice(0, 10)}.`],
    };
  }
  const period = periodEnding(input.ending);
  const digest = await computeDigest(db, input.tenantId, period);
  const hash = digestHash(digest);
  if (hash !== input.summaryHash) {
    return { ok: false, status: 409, errors: ["The digest changed since you read it. Read it again and acknowledge what is on the page now."] };
  }
  const id = uuidv7(now.getTime());
  await db.insert(digestAcks).values({
    id,
    tenantId: input.tenantId,
    periodStart: period.start,
    periodEnd: period.end,
    summaryHash: hash,
    eventCount: digest.chain.events,
    acknowledgedById: input.actor.id,
    acknowledgedByName: input.actor.name,
    acknowledgedAt: now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "digest.acknowledged",
    { ackId: id, periodStart: period.start, periodEnd: period.end, summaryHash: hash, eventCount: digest.chain.events },
    now
  );
  const rows = await db.select().from(digestAcks).where(eq(digestAcks.id, id));
  return { ok: true, ack: mapAck(rows[0]!) };
}
