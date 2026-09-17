import { and, eq, gte, lte, sql } from "drizzle-orm";
import { bankTransactions, reconciliationRuns, reconciliationVariances } from "@pms/db";
import type { MatchingMeasurementSummary } from "@pms/controls-engine";
import type { AppDb } from "../db/client";
import { RECONCILIATION_WINDOW_DAYS, windowStartFor } from "./reconciliationMeasure";

/**
 * Detection lag and the 48-hour match rate, measured rather than assumed.
 *
 * docs/05: "detection lag is measured in days between posting and matched
 * bank transaction; match rate within 48 hours is stored." docs/01: the
 * control "is measured (match rate, median lag), never a self-asserted
 * checkbox."
 *
 * The cohort is every bank line the practice holds whose posting date falls
 * inside the window and is at least MATCH_DUE_DAYS old, so a line posted
 * yesterday is not yet a miss. For each line the practice resolved it on
 * the day it matched a deposit (matching happens when the statement is
 * imported), or on the day its variance was cleared or waived; a line still
 * open counts at its age today, a lower bound the sentence names.
 *
 * - Detection lag is the median of those days over every line in the cohort.
 * - The 48-hour match rate is the share of bank credits (money in) that
 *   matched a practice deposit on the posting date or within the two
 *   following calendar days. Debits are not matched by anything yet, so they
 *   count toward lag only; the sentence says so.
 *
 * Nothing here moves a score. The engine records the measurement on the
 * snapshot and names it in the assumptions until a CPA calibrates a weight.
 */
export const MATCH_DUE_DAYS = 2;

export type BankLineFacts = {
  bankTransactionId: string;
  /** YYYY-MM-DD. */
  postedDate: string;
  amountCents: number;
  /** YYYY-MM-DD: the day the run carrying this line was opened, which is when matching ran. */
  importedOn: string;
  matched: boolean;
  /** The variance row's status: matched, open, cleared, or waived. */
  status: string;
  /** YYYY-MM-DD when the run was cleared, else null. */
  clearedOn: string | null;
};

export type MatchingMeasurement = MatchingMeasurementSummary & {
  asOf: string;
  /** Latest posting date in the cohort: lines posted after it are too young to count. */
  cohortEnd: string;
  windowStart: string;
};

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The day the practice resolved the line, or asOf when it is still open. */
export function resolvedOn(line: BankLineFacts, asOf: string): { on: string; open: boolean } {
  if (line.matched) return { on: line.importedOn, open: false };
  if ((line.status === "cleared" || line.status === "waived") && line.clearedOn) return { on: line.clearedOn, open: false };
  return { on: asOf, open: true };
}

function formatDays(n: number): string {
  return Number.isInteger(n) ? `${n} day${n === 1 ? "" : "s"}` : `${n.toFixed(1)} days`;
}

export function measureMatching(
  lines: BankLineFacts[],
  asOf: string,
  windowDays: number = RECONCILIATION_WINDOW_DAYS,
  dueDays: number = MATCH_DUE_DAYS
): MatchingMeasurement {
  const windowStart = windowStartFor(asOf, windowDays);
  const cohortEnd = windowStartFor(asOf, dueDays);
  const cohort = lines.filter((l) => l.postedDate >= windowStart && l.postedDate <= cohortEnd);
  const base = { asOf, cohortEnd, windowStart, windowDays, dueDays, linesInWindow: cohort.length };

  if (cohort.length === 0) {
    return {
      ...base,
      creditsInWindow: 0,
      creditsMatched: 0,
      creditsMatchedWithinDue: 0,
      matchRate48hPct: null,
      medianLagDays: null,
      maxLagDays: null,
      openLines: 0,
      why: `No bank line posted in the last ${windowDays} days is ${dueDays * 24} hours old yet, so there is nothing to measure.`,
    };
  }

  const lags: number[] = [];
  let openLines = 0;
  let creditsInWindow = 0;
  let creditsMatched = 0;
  let creditsMatchedWithinDue = 0;
  for (const line of cohort) {
    const r = resolvedOn(line, asOf);
    const lag = Math.max(0, daysBetween(line.postedDate, r.on));
    lags.push(lag);
    if (r.open) openLines += 1;
    if (line.amountCents > 0) {
      creditsInWindow += 1;
      if (line.matched) {
        creditsMatched += 1;
        if (lag <= dueDays) creditsMatchedWithinDue += 1;
      }
    }
  }
  const medianLagDays = median(lags);
  const maxLagDays = Math.max(...lags);
  const matchRate48hPct = creditsInWindow === 0 ? null : Math.round((creditsMatchedWithinDue / creditsInWindow) * 1000) / 10;

  const rate =
    creditsInWindow === 0
      ? "No bank credit posted in the window, so the 48-hour match rate is not defined"
      : `${creditsMatchedWithinDue} of ${creditsInWindow} bank credit${creditsInWindow === 1 ? "" : "s"} matched a practice deposit within ${dueDays * 24} hours (${matchRate48hPct}%)`;
  const debits = cohort.length - creditsInWindow;
  const why =
    `${rate}; median detection lag ${formatDays(medianLagDays!)} across ${cohort.length} bank line${cohort.length === 1 ? "" : "s"}` +
    (openLines > 0 ? `, ${openLines} still open and counted at ${openLines === 1 ? "its" : "their"} age today` : "") +
    "." +
    (debits > 0 ? " Debits are not matched yet and count toward lag only." : "");

  return {
    ...base,
    creditsInWindow,
    creditsMatched,
    creditsMatchedWithinDue,
    matchRate48hPct,
    medianLagDays,
    maxLagDays,
    openLines,
    why,
  };
}

/** The engine-facing summary: what the snapshot freezes. */
export function matchingSummary(m: MatchingMeasurement): MatchingMeasurementSummary {
  return {
    windowDays: m.windowDays,
    dueDays: m.dueDays,
    linesInWindow: m.linesInWindow,
    creditsInWindow: m.creditsInWindow,
    creditsMatched: m.creditsMatched,
    creditsMatchedWithinDue: m.creditsMatchedWithinDue,
    matchRate48hPct: m.matchRate48hPct,
    medianLagDays: m.medianLagDays,
    maxLagDays: m.maxLagDays,
    openLines: m.openLines,
    why: m.why,
  };
}

/**
 * Reads the tenant's bank lines in the window with the run that first
 * carried each (a statement imported twice yields one line, two variance
 * rows; the earliest run is the detection) and measures them.
 */
export async function measureMatchingLive(
  db: AppDb,
  tenantId: string,
  now: Date = new Date(),
  windowDays: number = RECONCILIATION_WINDOW_DAYS,
  dueDays: number = MATCH_DUE_DAYS
): Promise<MatchingMeasurement> {
  const asOf = now.toISOString().slice(0, 10);
  const windowStart = windowStartFor(asOf, windowDays);
  const cohortEnd = windowStartFor(asOf, dueDays);
  const rows = await db
    .select({
      bankTransactionId: bankTransactions.id,
      postedDate: bankTransactions.postedDate,
      amountCents: bankTransactions.amountCents,
      status: reconciliationVariances.status,
      runCreatedAt: reconciliationRuns.createdAt,
      runClearedAt: reconciliationRuns.clearedAt,
    })
    .from(bankTransactions)
    .innerJoin(reconciliationVariances, eq(reconciliationVariances.bankTransactionId, bankTransactions.id))
    .innerJoin(reconciliationRuns, eq(reconciliationRuns.id, reconciliationVariances.runId))
    .where(
      and(
        eq(bankTransactions.tenantId, tenantId),
        gte(bankTransactions.postedDate, windowStart),
        lte(bankTransactions.postedDate, cohortEnd)
      )
    )
    .orderBy(sql`${reconciliationRuns.createdAt} asc`);

  const first = new Map<string, BankLineFacts>();
  for (const row of rows) {
    if (first.has(row.bankTransactionId)) continue;
    first.set(row.bankTransactionId, {
      bankTransactionId: row.bankTransactionId,
      postedDate: String(row.postedDate),
      amountCents: Number(row.amountCents),
      importedOn: row.runCreatedAt.toISOString().slice(0, 10),
      matched: row.status === "matched",
      status: row.status,
      clearedOn: row.runClearedAt?.toISOString().slice(0, 10) ?? null,
    });
  }
  return measureMatching([...first.values()], asOf, windowDays, dueDays);
}
