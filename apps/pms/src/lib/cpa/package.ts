import { createHash } from "node:crypto";
import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { activeDecisions, channelCoverage, overdueReviews, type ThresholdException } from "@pms/controls-engine";
import { auditChainChecks, dayCloses, deposits, domainEvent, ledgerEntries } from "@pms/db";
import type { AppDb } from "../db/client";
import { listDecisions } from "../controls/decisions";
import { ENFORCEMENT } from "../controls/enforcement";
import { ATTESTABLE_CHANNELS, listMonthAttestations } from "../controls/attestations";
import { attestationCoverage } from "../controls/attestationCoverage";
import { appendControlEvent } from "../controls/events";
import { loadActivePolicy } from "../controls/policy";
import { canonicalJson, computeDigest, type DigestPeriod, type WeeklyDigest } from "../digest/digest";
import { activeMappings, pendingMappings, resolveMapping } from "./mappings";
import type { GlMapping } from "./types";
import { soleDeciderSentence } from "./soleDecider";
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

export type JournalRow = {
  bucket: string;
  kind: string;
  label: string;
  count: number;
  cents: number;
  /** The approved mapping for this line, or null when the practice has not mapped it (Increment 1.35). */
  account: { code: string; name: string; side: string } | null;
};
export type ReasonRow = { code: string; kind: string; label: string; count: number; cents: number; withApproval: number };
export type DepositRow = { method: string; status: string; count: number; cents: number };
export type TieOut = { key: string; label: string; holds: boolean; detail: string };

/**
 * One day of this month that the practice sealed and that a ledger row then
 * landed against (Increment 1.44). Aggregate: a date two locations both sealed
 * is one row, and `closes` says how many seals it covers.
 */
export type SealedDayRow = {
  businessDate: string;
  closes: number;
  postings: number;
  /** Of those, the ones that are not half of a correction: a first posting names nothing. */
  firstPostings: number;
  cents: number;
};

export type MonthPackage = {
  month: string;
  period: { start: string; end: string; days: number };
  journal: { rows: JournalRow[]; entryCount: number; totalCents: number };
  reasons: { rows: ReasonRow[] };
  depositRegister: { rows: DepositRow[]; count: number; totalCents: number };
  /** The same counts the weekly digest computes, over the month. */
  counts: WeeklyDigest;
  /**
   * The chart-of-accounts mapping in force, and what is still unmapped or
   * waiting (Increment 1.35).
   *
   * `decidedAlone` counts the mappings **this month's own lines were read
   * through** that one person both proposed and decided (Increment 1.75), so
   * it is a figure about the month and sits inside the hash. A practice with a
   * single administrator can
   * only close a month at all by recording a decision that lets it, and the
   * accountant reading these figures is the one independent party this
   * product has: they receive the fact here rather than depending on somebody
   * thinking to mention it. Counted from the rows — a mapping was decided
   * alone exactly when `decidedById` equals `proposedById` — so no stored
   * figure can disagree with the mappings underneath it.
   */
  mappings: { approved: number; pending: number; unmappedLines: number; decidedAlone: number };
  /**
   * The days of this month the practice sealed, and what posted against them
   * afterward (Increment 1.44). Windowed on the sealed day, not on the posting:
   * the question is which days of this month moved after they were counted, and
   * a row posted in a later month against one of them is exactly that case.
   */
  sealedDays: { closesFrozen: number; daysDisturbed: SealedDayRow[]; postings: number; firstPostings: number; totalCents: number };
  controls: {
    coverage: { channel: string; label: string; enforcement: string; status: string; thresholdUsd: number; activeExceptions: number }[];
    activeExceptions: { id: string; label: string; action: string; channels: string[]; effectiveTo: string | null }[];
    decisions: { active: number; overdueAtMonthEnd: number; recordedInMonth: number };
    attestations: { channel: string; count: number }[];
    /**
     * Who said they reviewed each channel this build cannot enforce, for this
     * month (Increment 1.51). Distinct from `attestations` above, which counts
     * the per-release attestations the evaluator recorded as they happened:
     * this is one dated assertion about the month as a whole, and the seat says
     * whether an independent reader or the practice itself made it.
     */
    monthAttestations: { channel: string; seat: string; byName: string; at: string }[];
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
  "Every figure is the practice's for the calendar month, from the rows the product holds; journal lines carry the ledger bucket, the kind, and the reason code, never a patient or a poster. Each line shows the account the practice mapped it to, or reads unmapped; a mapping is proposed by one person and approved by another. The package hash covers every figure the package states about the month, and none of the figures that state the practice's position right now, so an accountant can tell whether the month itself moved after they took it.";

export async function computeMonthPackage(db: AppDb, tenantId: string, month: string): Promise<MonthPackage> {
  const period = monthPeriod(month);
  const inWindow = (table: { tenantId: AnyPgColumn }, column: AnyPgColumn) =>
    and(eq(table.tenantId, tenantId), gte(column, period.startAt), lt(column, period.endAt));

  const counts = await computeDigest(db, tenantId, period);

  // The journal: every posting of the month by ledger bucket and kind, each line
  // resolved to the account the practice mapped it to, or left plainly unmapped.
  const active = await activeMappings(db, tenantId);
  const pending = await pendingMappings(db, tenantId);
  const journalRows = await db
    .select({ bucket: ledgerEntries.glBucket, kind: ledgerEntries.kind, n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::bigint` })
    .from(ledgerEntries)
    .where(inWindow(ledgerEntries, ledgerEntries.postedAt))
    .groupBy(ledgerEntries.glBucket, ledgerEntries.kind)
    .orderBy(ledgerEntries.glBucket, ledgerEntries.kind);
  // Which mappings this month's own lines were read through (Increment 1.75),
  // so the single-person count below is a figure about the month rather than
  // the practice's position now. `approved` and `pending` are position-now and
  // deliberately outside the hash; a count over every active mapping would
  // move a frozen month's hash whenever a later month decided one alone, which
  // is precisely the coupling Increment 1.42 found and 1.43 made legible.
  const mappingsUsed = new Map<string, GlMapping>();
  const journal = journalRows.map<JournalRow>((r) => {
    const mapping = resolveMapping(active, r.bucket, r.kind, null);
    if (mapping) mappingsUsed.set(mapping.id, mapping);
    return {
      bucket: r.bucket,
      kind: r.kind,
      label: `${r.bucket.replace(/_/g, " ")} · ${formatLedgerKind(r.kind)}`,
      count: Number(r.n),
      cents: Number(r.cents),
      account: mapping ? { code: mapping.accountCode, name: mapping.accountName, side: mapping.side } : null,
    };
  });
  const unmappedLines = journal.filter((r) => !r.account).length;
  // One pair of hands on both ends of a mapping this month's figures rest on.
  const decidedAlone = [...mappingsUsed.values()].filter((m) => m.decidedById !== null && m.decidedById === m.proposedById).length;

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
  const policy = await loadActivePolicy(db, tenantId);
  const coverage = policy ? channelCoverage(policy.policy, ENFORCEMENT, period.end) : [];
  const exceptions = (policy?.policy.exceptions ?? []).filter((e: ThresholdException) => e.enabled && (!e.effectiveTo || e.effectiveTo >= period.end));
  const decisions = await listDecisions(db, tenantId);
  const asOfEnd = decisions.filter((d) => d.decidedAt < period.endAt.toISOString());
  const attestRows = await db
    .select({ channel: sql<string>`${domainEvent.payload}->>'channel'`, n: sql<number>`count(*)::int` })
    .from(domainEvent)
    .where(and(inWindow(domainEvent, domainEvent.occurredAt), eq(domainEvent.kind, "control.release_attested")))
    .groupBy(sql`${domainEvent.payload}->>'channel'`)
    .orderBy(sql`${domainEvent.payload}->>'channel'`);

  const monthAttestations = (await listMonthAttestations(db, tenantId, month))
    .filter((r) => r.attestation !== null)
    .map((r) => ({
      channel: r.channel,
      seat: r.attestation!.seat as string,
      byName: r.attestation!.byName,
      at: r.attestation!.at,
    }));

  // The days this month that the practice sealed, and what landed behind them
  // (Increment 1.44). The window is the sealed day, not the posting: a row that
  // posted in a later month against one of this month's sealed days is precisely
  // the case an accountant reconciling daily slips against the journal will hit,
  // because the journal windows on posted_at and so does not carry that row.
  const [frozen] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(dayCloses)
    .where(
      and(
        eq(dayCloses.tenantId, tenantId),
        eq(dayCloses.status, "frozen"),
        gte(dayCloses.businessDate, period.start),
        lte(dayCloses.businessDate, period.end)
      )
    );
  const sealedRows = await db
    .select({
      businessDate: dayCloses.businessDate,
      closes: sql<number>`count(DISTINCT ${dayCloses.id})::int`,
      postings: sql<number>`count(*)::int`,
      firstPostings: sql<number>`count(*) FILTER (WHERE ${ledgerEntries.correctsEntryId} IS NULL)::int`,
      cents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::bigint`,
    })
    .from(ledgerEntries)
    .innerJoin(dayCloses, eq(dayCloses.id, ledgerEntries.closedDayId))
    .where(
      and(
        eq(ledgerEntries.tenantId, tenantId),
        eq(ledgerEntries.postedAfterClose, true),
        gte(dayCloses.businessDate, period.start),
        lte(dayCloses.businessDate, period.end)
      )
    )
    .groupBy(dayCloses.businessDate)
    .orderBy(dayCloses.businessDate);
  const daysDisturbed: SealedDayRow[] = sealedRows.map((r) => ({
    businessDate: String(r.businessDate),
    closes: Number(r.closes),
    postings: Number(r.postings),
    firstPostings: Number(r.firstPostings),
    cents: Number(r.cents),
  }));
  const sealedDays = {
    closesFrozen: Number(frozen?.n ?? 0),
    daysDisturbed,
    postings: daysDisturbed.reduce((n, r) => n + r.postings, 0),
    firstPostings: daysDisturbed.reduce((n, r) => n + r.firstPostings, 0),
    totalCents: daysDisturbed.reduce((n, r) => n + r.cents, 0),
  };

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

  // What nobody vouched for is the state that matters, so the tie-out says it
  // in the same words the owner board does (Increment 1.52).
  const attestCoverage = attestationCoverage({ month, channels: ATTESTABLE_CHANNELS, attested: monthAttestations });

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
      key: "journal_mapped",
      label: "Every journal line is mapped to an account",
      holds: unmappedLines === 0,
      // The single-person count rides here rather than on the chart-of-accounts
      // section, because that section is the practice's own maker-checker and
      // the accountant's seat is not offered it (Increment 1.49). This row is
      // one the seat reads, and it is the row the count qualifies: "every line
      // is mapped" says nothing about how many hands agreed the mapping.
      detail:
        (unmappedLines === 0
          ? `${journal.length} line${journal.length === 1 ? "" : "s"} mapped from ${active.size} approved mapping${active.size === 1 ? "" : "s"}.`
          : `${unmappedLines} of ${journal.length} lines have no approved mapping${pending.length ? `; ${pending.length} proposal${pending.length === 1 ? "" : "s"} waiting for a second person` : ""}.`) +
        (decidedAlone > 0 ? ` ${soleDeciderSentence(decidedAlone, mappingsUsed.size)}` : ""),
    },
    {
      key: "sealed_days_undisturbed",
      label: "No row posted against a day this month after the practice sealed it",
      holds: sealedDays.postings === 0,
      detail:
        sealedDays.postings === 0
          ? `${sealedDays.closesFrozen} day${sealedDays.closesFrozen === 1 ? "" : "s"} sealed this month, none disturbed afterward.`
          : `${sealedDays.postings} row${sealedDays.postings === 1 ? "" : "s"} totalling ${formatCents(sealedDays.totalCents)} landed against ${sealedDays.daysDisturbed.length} of ${sealedDays.closesFrozen} sealed day${sealedDays.closesFrozen === 1 ? "" : "s"}, ${sealedDays.firstPostings} of them first postings. The sealed figures did not move, so those days read two ways.`,
    },
    {
      key: "external_channels_attested",
      label: "Every channel the product cannot enforce was reviewed by somebody",
      holds: attestCoverage.complete,
      detail: attestCoverage.sentence,
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
    sealedDays,
    mappings: { approved: active.size, pending: pending.length, unmappedLines, decidedAlone },
    controls: {
      coverage: coverage.map((c) => ({ channel: c.channel, label: c.label, enforcement: c.enforcement, status: c.status, thresholdUsd: c.thresholdUsd, activeExceptions: c.activeExceptions })),
      activeExceptions: exceptions.map((e) => ({ id: e.id, label: e.label, action: e.action, channels: e.channels, effectiveTo: e.effectiveTo ?? null })),
      decisions: {
        active: activeDecisions(asOfEnd).filter((d) => d.kind !== "retire").length,
        overdueAtMonthEnd: overdueReviews(asOfEnd, period.end).length,
        recordedInMonth: counts.decisions.recorded.reduce((n, r) => n + r.count, 0),
      },
      attestations: attestRows.map((r) => ({ channel: r.channel, count: Number(r.n) })),
      monthAttestations,
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

/**
 * The shape of what the package states about a month (Increment 1.43).
 *
 * Bump this whenever a field enters or leaves `hashedView` — adding a count to
 * the weekly digest does exactly that, because the digest is folded in whole.
 * Hashes compare only within one version: a close records the version it froze,
 * and a month closed under an earlier one is reported as incomparable rather
 * than as changed, with the figures the close froze in their own columns
 * answering in the hash's place.
 *
 * v1: Increments 1.34 to 1.42. v2: the digest's sealed-day counts (1.43).
 * v3: the sealed-days section and its tie-out (1.44).
 * v4: who attested each external channel for the month (1.51).
 * v5: the tie-out line for the channels nobody vouched for (1.52).
 * v6: the digest's count of channels attested in the period (1.53).
 */
/**
 * Increment 1.75 moves this to v7: how many mappings in force one person
 * decided alone is a figure about the month, so it belongs inside the hash.
 * A month closed under v6 reports "the package changed shape" rather than "a
 * figure moved", which is the fallback Increment 1.43 built for exactly this.
 */
export const PACKAGE_SCHEMA_VERSION = "package-v7";

/**
 * What the hash covers: every figure the package states about the month.
 *
 * A package mixes two kinds of figure. Most state something about the month
 * — the journal and the accounts its lines map to, the reasons, the deposit
 * register, the counts, how many lines the month left unmapped, the controls
 * as they stood at month end, how many chain events the month carried, which
 * tie-outs held. The rest state the practice's position right now and say so
 * on their face: the chain head, the last nightly check, how many findings
 * are open, how many reviews are overdue, and how much of the chart of
 * accounts is approved or waiting. The hash covers the first kind alone.
 *
 * The reason is the close. A hash that moved whenever the practice appended
 * any chain event would differ from the frozen one the moment the close's
 * own event landed, and every closed month would report a change it never
 * had. A tie-out's prose is left out for the same reason — it quotes those
 * practice-wide counts; its key and its verdict carry the fact.
 *
 * The view carries its own schema version (Increment 1.43). What the package
 * states about a month is a shape that grows: the weekly digest is folded in
 * whole, so one field added to the digest changes the hash of every month
 * already closed. Naming the shape inside the hash makes a close say which
 * one it froze, so the page can tell "the shape changed" from "a figure
 * moved" rather than reporting the first as the second forever.
 */
export function hashedView(pkg: MonthPackage) {
  const { findings, decisions, ...counts } = pkg.counts;
  return {
    schema: PACKAGE_SCHEMA_VERSION,
    month: pkg.month,
    period: pkg.period,
    journal: pkg.journal,
    reasons: pkg.reasons,
    depositRegister: pkg.depositRegister,
    counts: {
      ...counts,
      findings: { opened: findings.opened, closed: findings.closed },
      decisions: { recorded: decisions.recorded, reviews: decisions.reviews, snapshotsFrozen: decisions.snapshotsFrozen },
    },
    unmappedLines: pkg.mappings.unmappedLines,
    // A figure about the month: how many of the mappings this month's lines
    // were read through had one pair of hands on both ends (Increment 1.75).
    // Sealed with the month, so the copy the accountant received still says it.
    mappingsDecidedAlone: pkg.mappings.decidedAlone,
    sealedDays: pkg.sealedDays,
    controls: pkg.controls,
    eventsInMonth: pkg.chain.eventsInMonth,
    tieOut: pkg.tieOut.filter((t) => t.key !== "chain_verified").map((t) => ({ key: t.key, holds: t.holds })),
  };
}

/** sha256 of that view; the same month always gives the same hash. */
export function packageHash(pkg: MonthPackage): string {
  return createHash("sha256").update(canonicalJson(hashedView(pkg))).digest("hex");
}

export type CsvRow = { section: string; key: string; label: string; count: number | ""; cents: number | "" };

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The package as flat rows: section, key, label, count, cents; the hash last. */
export function packageRows(pkg: MonthPackage, hash: string): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const r of pkg.journal.rows) {
    rows.push({ section: "journal", key: `${r.bucket}|${r.kind}`, label: r.account ? `${r.label} → ${r.account.code} ${r.account.name} (${r.account.side})` : `${r.label} → unmapped`, count: r.count, cents: r.cents });
  }
  rows.push({ section: "journal", key: "total", label: "Journal total", count: pkg.journal.entryCount, cents: pkg.journal.totalCents });
  for (const r of pkg.reasons.rows) rows.push({ section: "reasons", key: `${r.kind}|${r.code}`, label: `${r.label} (with approval: ${r.withApproval})`, count: r.count, cents: r.cents });
  for (const r of pkg.depositRegister.rows) rows.push({ section: "deposits", key: `${r.method}|${r.status}`, label: `${r.method} · ${r.status}`, count: r.count, cents: r.cents });
  for (const r of pkg.sealedDays.daysDisturbed) {
    rows.push({
      section: "sealed_days",
      key: r.businessDate,
      label: `${r.businessDate} · ${r.closes} seal${r.closes === 1 ? "" : "s"} · ${r.firstPostings} first posting${r.firstPostings === 1 ? "" : "s"}`,
      count: r.postings,
      cents: r.cents,
    });
  }
  rows.push({ section: "sealed_days", key: "closes_frozen", label: "Day closes frozen this month", count: pkg.sealedDays.closesFrozen, cents: "" });
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
    ["mappings", "approved", pkg.mappings.approved],
    ["mappings", "pending", pkg.mappings.pending],
    ["mappings", "decided_by_one_person", pkg.mappings.decidedAlone],
    ["mappings", "unmapped_journal_lines", pkg.mappings.unmappedLines],
  ];
  for (const [section, key, count] of flat) rows.push({ section, key, label: key.replace(/_/g, " "), count, cents: "" });
  for (const r of pkg.controls.coverage) rows.push({ section: "coverage", key: r.channel, label: `${r.label} · ${r.enforcement} · ${r.status}`, count: r.activeExceptions, cents: "" });
  for (const e of pkg.controls.activeExceptions) rows.push({ section: "exceptions", key: e.id, label: `${e.label} · ${e.action} · ${e.channels.join("/") || "all"}${e.effectiveTo ? ` · until ${e.effectiveTo}` : ""}`, count: 1, cents: "" });
  for (const a of pkg.controls.attestations) rows.push({ section: "attestations", key: a.channel, label: `${a.channel} attested`, count: a.count, cents: "" });
  for (const a of pkg.controls.monthAttestations) {
    rows.push({
      section: "attestations",
      key: `month:${a.channel}`,
      label: `${a.channel} reviewed for the month by ${a.byName} (${a.seat}) on ${a.at.slice(0, 10)}`,
      count: 1,
      cents: "",
    });
  }
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
