import { createHash } from "node:crypto";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { activeDecisions, channelCoverage, overdueReviews, type ThresholdException } from "@pms/controls-engine";
import { auditChainChecks, deposits, domainEvent, ledgerEntries } from "@pms/db";
import type { AppDb } from "../db/client";
import { listDecisions } from "../controls/decisions";
import { ENFORCEMENT } from "../controls/enforcement";
import { appendControlEvent } from "../controls/events";
import { loadActivePolicy } from "../controls/policy";
import { canonicalJson, computeDigest, type DigestPeriod, type WeeklyDigest } from "../digest/digest";
import { formatCents, formatLedgerKind } from "../ledger/format";

/**
 * The CPA month-end package (docs/13 item 22, first slice; Increment 1.34):
 * one calendar month of the practice's rows, aggregate and PHI-minimal,
 * computed on every read and hash-stamped, so the accountant can tell
 * whether a month changed after they took it. Journal lines carry the
 * ledger bucket, the kind, the reason code, counts, and amounts; nothing
 * here names a patient or a poster. Every export is a chain event carrying
 * the hash and the row count.
 */

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH.test(value);
}

/** The calendar month `YYYY-MM`, first day to last day inclusive. */
export function monthPeriod(month: string): DigestPeriod {
  if (!isMonth(month)) throw new Error(`Not a calendar month: ${month}`);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const startAt = new Date(Date.UTC(y, m - 1, 1));
  const endAt = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(endAt.getTime() - 86_400_000);
  const days = Math.round((endAt.getTime() - startAt.getTime()) / 86_400_000);
  return { start: startAt.toISOString().slice(0, 10), end: lastDay.toISOString().slice(0, 10), days, startAt, endAt };
}

export type JournalRow = { bucket: string; kind: string; label: string; count: number; cents: number };
export type ReasonRow = { code: string; kind: string; label: string; count: number; cents: number; withApproval: number };
export type DepositRow = { method: string; status: string; count: number; cents: number };
export type TieOut = { key: string; label: string; holds: boolean; detail: string };

export type MonthPackage = {
  month: string;
  period: { start: string; end: string; days: number };
  journal: { rows: JournalRow[]; entryCount: number; totalCents: number };
  reasons: { rows: ReasonRow[] };
  depositRegister: { rows: DepositRow[]; count: number; totalCents: number };
  /** The same counts the weekly digest computes, over the month. */
  counts: WeeklyDigest;
  controls: {
    coverage: { channel: string; label: string; enforcement: string; status: string; thresholdUsd: number; activeExceptions: number }[];
    activeExceptions: { id: string; label: string; action: string; channels: string[]; effectiveTo: string | null }[];
    decisions: { active: number; overdueAtMonthEnd: number; recordedInMonth: number };
    attestations: { channel: string; count: number }[];
  };
  chain: {
    headSeq: number | null;
    headHash: string | null;
    eventsInMonth: number;
    lastCheck: { day: string; ok: boolean; checkedAt: string } | null;
  };
  tieOut: TieOut[];
  scope: string;
};

export const PACKAGE_SCOPE =
  "Every figure is the practice's for the calendar month, from the rows the product holds; journal lines carry the ledger bucket, the kind, and the reason code, never a patient or a poster. The package hash changes when any figure changes, so an accountant can tell whether a month moved after they took it.";

export async function computeMonthPackage(db: AppDb, tenantId: string, month: string): Promise<MonthPackage> {
  const period = monthPeriod(month);
  const inWindow = (table: { tenantId: AnyPgColumn }, column: AnyPgColumn) =>
    and(eq(table.tenantId, tenantId), gte(column, period.startAt), lt(column, period.endAt));

  const counts = await computeDigest(db, tenantId, period);

  // The journal: every posting of the month by ledger bucket and kind.
  const journalRows = await db
    .select({ bucket: ledgerEntries.glBucket, kind: ledgerEntries.kind, n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::bigint` })
    .from(ledgerEntries)
    .where(inWindow(ledgerEntries, ledgerEntries.postedAt))
    .groupBy(ledgerEntries.glBucket, ledgerEntries.kind)
    .orderBy(ledgerEntries.glBucket, ledgerEntries.kind);
  const journal = journalRows.map<JournalRow>((r) => ({ bucket: r.bucket, kind: r.kind, label: `${r.bucket.replace(/_/g, " ")} · ${formatLedgerKind(r.kind)}`, count: Number(r.n), cents: Number(r.cents) }));

  // Adjustments, write-offs, refunds, and reversals by reason code, with how many cited an approval.
  const reasonRows = await db
    .select({
      code: sql<string>`coalesce(${ledgerEntries.reasonCode}, '(none)')`,
      kind: ledgerEntries.kind,
      n: sql<number>`count(*)::int`,
      cents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::bigint`,
      approved: sql<number>`count(${ledgerEntries.approvalRequestId})::int`,
    })
    .from(ledgerEntries)
    .where(and(inWindow(ledgerEntries, ledgerEntries.postedAt), sql`${ledgerEntries.kind} in ('adjustment', 'write_off', 'refund', 'reversal')`))
    .groupBy(sql`coalesce(${ledgerEntries.reasonCode}, '(none)')`, ledgerEntries.kind)
    .orderBy(ledgerEntries.kind, sql`coalesce(${ledgerEntries.reasonCode}, '(none)')`);
  const reasons = reasonRows.map<ReasonRow>((r) => ({ code: r.code, kind: r.kind, label: `${formatLedgerKind(r.kind)} · ${r.code}`, count: Number(r.n), cents: Number(r.cents), withApproval: Number(r.approved) }));

  // The deposit register by method and status, from the deposits the practice prepared.
  const depositRows = await db
    .select({ method: deposits.method, status: deposits.status, n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${deposits.amountCents}), 0)::bigint` })
    .from(deposits)
    .where(inWindow(deposits, deposits.createdAt))
    .groupBy(deposits.method, deposits.status)
    .orderBy(deposits.method, deposits.status);
  const register = depositRows.map<DepositRow>((r) => ({ method: r.method, status: r.status, count: Number(r.n), cents: Number(r.cents) }));

  // Controls at month end: coverage, standing exceptions, the register, and attestations on external channels.
  const active = await loadActivePolicy(db, tenantId);
  const coverage = active ? channelCoverage(active.policy, ENFORCEMENT, period.end) : [];
  const exceptions = (active?.policy.exceptions ?? []).filter((e: ThresholdException) => e.enabled && (!e.effectiveTo || e.effectiveTo >= period.end));
  const decisions = await listDecisions(db, tenantId);
  const asOfEnd = decisions.filter((d) => d.decidedAt < period.endAt.toISOString());
  const attestRows = await db
    .select({ channel: sql<string>`${domainEvent.payload}->>'channel'`, n: sql<number>`count(*)::int` })
    .from(domainEvent)
    .where(and(inWindow(domainEvent, domainEvent.occurredAt), eq(domainEvent.kind, "control.release_attested")))
    .groupBy(sql`${domainEvent.payload}->>'channel'`)
    .orderBy(sql`${domainEvent.payload}->>'channel'`);

  // The chain head as of now, and the last nightly check.
  const [head] = await db
    .select({ seq: domainEvent.seq, hash: domainEvent.hash })
    .from(domainEvent)
    .where(eq(domainEvent.tenantId, tenantId))
    .orderBy(desc(domainEvent.seq))
    .limit(1);
  const [check] = await db
    .select({ day: auditChainChecks.day, ok: auditChainChecks.ok, checkedAt: auditChainChecks.checkedAt })
    .from(auditChainChecks)
    .where(eq(auditChainChecks.tenantId, tenantId))
    .orderBy(desc(auditChainChecks.checkedAt))
    .limit(1);

  const journalTotal = journal.reduce((n, r) => n + r.cents, 0);
  const entryCount = journal.reduce((n, r) => n + r.count, 0);
  const postingsTotal = counts.money.postings.reduce((n, r) => n + (r.cents ?? 0), 0);
  const registerTotal = register.reduce((n, r) => n + r.cents, 0);
  const registerCount = register.reduce((n, r) => n + r.count, 0);

  const tieOut: TieOut[] = [
    {
      key: "journal_equals_postings",
      label: "Journal totals equal the month's ledger postings",
      holds: journalTotal === postingsTotal && entryCount === counts.money.postingCount,
      detail: `${entryCount} entries totalling ${formatCents(journalTotal)} by bucket; ${counts.money.postingCount} postings totalling ${formatCents(postingsTotal)} by kind.`,
    },
    {
      key: "register_equals_deposits",
      label: "The deposit register equals the deposits prepared",
      holds: registerCount === counts.bank.depositsPrepared,
      detail: `${registerCount} deposits totalling ${formatCents(registerTotal)} in the register; ${counts.bank.depositsPrepared} prepared.`,
    },
    {
      key: "chain_verified",
      label: "The audit chain verified at its last check",
      holds: check?.ok === true,
      detail: check
        ? `Checked ${String(check.day)}: ${check.ok ? "verified" : "failed"}. Head now at sequence ${head?.seq ?? 0}.`
        : "No chain check recorded yet; the nightly verifier has not run against this database.",
    },
  ];

  return {
    month,
    period: { start: period.start, end: period.end, days: period.days },
    journal: { rows: journal, entryCount, totalCents: journalTotal },
    reasons: { rows: reasons },
    depositRegister: { rows: register, count: registerCount, totalCents: registerTotal },
    counts,
    controls: {
      coverage: coverage.map((c) => ({ channel: c.channel, label: c.label, enforcement: c.enforcement, status: c.status, thresholdUsd: c.thresholdUsd, activeExceptions: c.activeExceptions })),
      activeExceptions: exceptions.map((e) => ({ id: e.id, label: e.label, action: e.action, channels: e.channels, effectiveTo: e.effectiveTo ?? null })),
      decisions: {
        active: activeDecisions(asOfEnd).filter((d) => d.kind !== "retire").length,
        overdueAtMonthEnd: overdueReviews(asOfEnd, period.end).length,
        recordedInMonth: counts.decisions.recorded.reduce((n, r) => n + r.count, 0),
      },
      attestations: attestRows.map((r) => ({ channel: r.channel, count: Number(r.n) })),
    },
    chain: {
      headSeq: head ? Number(head.seq) : null,
      headHash: head?.hash ?? null,
      eventsInMonth: counts.chain.events,
      lastCheck: check ? { day: String(check.day), ok: check.ok, checkedAt: check.checkedAt.toISOString() } : null,
    },
    tieOut,
    scope: PACKAGE_SCOPE,
  };
}

/** sha256 of the canonical package; the same rows always give the same hash. */
export function packageHash(pkg: MonthPackage): string {
  return createHash("sha256").update(canonicalJson(pkg)).digest("hex");
}

export type CsvRow = { section: string; key: string; label: string; count: number | ""; cents: number | "" };

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The package as flat rows: section, key, label, count, cents; the hash last. */
export function packageRows(pkg: MonthPackage, hash: string): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const r of pkg.journal.rows) rows.push({ section: "journal", key: `${r.bucket}|${r.kind}`, label: r.label, count: r.count, cents: r.cents });
  rows.push({ section: "journal", key: "total", label: "Journal total", count: pkg.journal.entryCount, cents: pkg.journal.totalCents });
  for (const r of pkg.reasons.rows) rows.push({ section: "reasons", key: `${r.kind}|${r.code}`, label: `${r.label} (with approval: ${r.withApproval})`, count: r.count, cents: r.cents });
  for (const r of pkg.depositRegister.rows) rows.push({ section: "deposits", key: `${r.method}|${r.status}`, label: `${r.method} · ${r.status}`, count: r.count, cents: r.cents });
  for (const r of pkg.counts.money.postings) rows.push({ section: "postings", key: r.key, label: r.label, count: r.count, cents: r.cents ?? "" });
  const c = pkg.counts;
  const flat: [string, string, number][] = [
    ["money", "guarded_with_second", c.money.guardedWithSecond],
    ["money", "guarded_without_second", c.money.guardedWithoutSecond],
    ["approvals", "requested", c.approvals.requested],
    ["approvals", "given", c.approvals.given],
    ["approvals", "declined", c.approvals.declined],
    ["bank", "statements_imported", c.bank.statementsImported],
    ["bank", "runs_cleared", c.bank.runsCleared],
    ["bank", "runs_owner_only", c.bank.runsOwnerOnly],
    ["bank", "variances_cleared_with_reason", c.bank.variancesClearedWithReason],
    ["bank", "day_closes_frozen", c.bank.dayClosesFrozen],
    ["bank", "statements_issued", c.bank.statementsIssued],
    ["findings", "open_at_month_end", c.findings.openNow],
    ["decisions", "active", pkg.controls.decisions.active],
    ["decisions", "overdue_at_month_end", pkg.controls.decisions.overdueAtMonthEnd],
    ["decisions", "recorded_in_month", pkg.controls.decisions.recordedInMonth],
    ["alerts", "after_hours_holds", c.alerts.afterHoursHolds],
    ["alerts", "hard_events_acknowledged", c.alerts.hardEventsAcknowledged],
    ["chain", "events_in_month", pkg.chain.eventsInMonth],
  ];
  for (const [section, key, count] of flat) rows.push({ section, key, label: key.replace(/_/g, " "), count, cents: "" });
  for (const r of pkg.controls.coverage) rows.push({ section: "coverage", key: r.channel, label: `${r.label} · ${r.enforcement} · ${r.status}`, count: r.activeExceptions, cents: "" });
  for (const e of pkg.controls.activeExceptions) rows.push({ section: "exceptions", key: e.id, label: `${e.label} · ${e.action} · ${e.channels.join("/") || "all"}${e.effectiveTo ? ` · until ${e.effectiveTo}` : ""}`, count: 1, cents: "" });
  for (const a of pkg.controls.attestations) rows.push({ section: "attestations", key: a.channel, label: `${a.channel} attested`, count: a.count, cents: "" });
  for (const t of pkg.tieOut) rows.push({ section: "tie_out", key: t.key, label: `${t.label}: ${t.holds ? "yes" : "no"}. ${t.detail}`, count: t.holds ? 1 : 0, cents: "" });
  rows.push({ section: "chain", key: "head", label: pkg.chain.headHash ?? "(empty chain)", count: pkg.chain.headSeq ?? "", cents: "" });
  rows.push({ section: "meta", key: "package_hash", label: hash, count: "", cents: "" });
  return rows;
}

export function toCsv(rows: CsvRow[]): string {
  const lines = ["section,key,label,count,cents"];
  for (const r of rows) lines.push([r.section, r.key, r.label, r.count, r.cents].map(csvField).join(","));
  return lines.join("\n") + "\n";
}

export type PackageExport = { at: string; format: "json" | "csv"; packageHash: string; rowCount: number };

/** Every export of a month, from the chain, newest first. */
export async function listPackageExports(db: AppDb, tenantId: string, month: string): Promise<PackageExport[]> {
  const rows = await db
    .select({ payload: domainEvent.payload, at: domainEvent.occurredAt })
    .from(domainEvent)
    .where(and(eq(domainEvent.tenantId, tenantId), eq(domainEvent.kind, "cpa.package_exported"), sql`${domainEvent.payload}->>'month' = ${month}`))
    .orderBy(desc(domainEvent.occurredAt));
  return rows.map((r) => {
    const p = r.payload as { format?: string; packageHash?: string; rowCount?: number };
    return { at: r.at.toISOString(), format: p.format === "csv" ? "csv" : "json", packageHash: String(p.packageHash ?? ""), rowCount: Number(p.rowCount ?? 0) };
  });
}

/** Records one export on the chain: the month, the format, the hash, and the row count that left. */
export async function recordPackageExport(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; month: string; format: "json" | "csv"; packageHash: string; rowCount: number; entryCount: number; totalCents: number; now?: Date }
): Promise<void> {
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "cpa.package_exported",
    { month: input.month, format: input.format, packageHash: input.packageHash, rowCount: input.rowCount, entryCount: input.entryCount, totalCents: input.totalCents },
    input.now ?? new Date()
  );
}
