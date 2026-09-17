import { and, eq, lte, sql } from "drizzle-orm";
import { bankTransactions, controlFindings, reconciliationRuns, reconciliationVariances, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { MATCH_DUE_DAYS, daysBetween } from "./matchingMeasure";
import { windowStartFor } from "./reconciliationMeasure";

/**
 * Detectors (docs/05: "recorded, batched"). A detector reads live rows and
 * keeps one control_findings row per (kind, subject): opened when the
 * condition holds, refreshed while it holds, closed with a reason when it
 * clears, reopened on recurrence, never deleted. The detail is a flat
 * object of facts about the subject; the sentence describes the line and
 * the process, never a person, so no output reads as an accusation.
 *
 * The first detector: a bank line the practice holds that has had no
 * matching deposit and no clearance for more than 48 hours since the bank
 * posted it (docs/05 "unmatched bank lines older than 48 hours"). It uses
 * the same 48-hour mark as the match-rate measurement, and the earliest
 * run that carried a line decides whether the line is still open, so a
 * statement imported twice does not reopen what the first run cleared.
 */
export const DETECTOR_VERSION = "detectors-v1";
export const UNMATCHED_BANK_LINE_KIND = "unmatched_bank_line_48h";

export const FINDING_KIND_LABEL: Record<string, string> = {
  unmatched_bank_line_48h: "Unmatched bank line older than 48 hours",
  degraded_owner_clearance: "Owner-only clearance",
  decision_unreviewed: "Decision past its review date",
};

export type ControlFindingRow = typeof controlFindings.$inferSelect;
export type FindingSeverity = "low" | "medium" | "high";

export type OpenBankLine = {
  bankTransactionId: string;
  bankAccountId: string;
  runId: string;
  /** YYYY-MM-DD. */
  postedDate: string;
  amountCents: number;
  description: string;
  ageDays: number;
};

/** Under a week is low; a month or less is medium; older is high. */
export function severityForAge(ageDays: number): FindingSeverity {
  if (ageDays < 7) return "low";
  if (ageDays <= 30) return "medium";
  return "high";
}

function money(cents: number): string {
  const abs = Math.abs(cents);
  return `$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
}

/** One sentence about the line and the process. Names no one. */
export function lineSentence(line: OpenBankLine): string {
  const kind = line.amountCents > 0 ? "credit" : "debit";
  return `A ${money(line.amountCents)} bank ${kind} posted ${line.postedDate} (${line.description}) has had no matching deposit and no clearance for ${line.ageDays} day${line.ageDays === 1 ? "" : "s"}.`;
}

export type LineDetail = {
  postedDate: string;
  amountCents: number;
  description: string;
  bankAccountId: string;
  runId: string;
  ageDays: number;
  sentence: string;
};

export function lineDetail(line: OpenBankLine): LineDetail {
  return {
    postedDate: line.postedDate,
    amountCents: line.amountCents,
    description: line.description,
    bankAccountId: line.bankAccountId,
    runId: line.runId,
    ageDays: line.ageDays,
    sentence: lineSentence(line),
  };
}

export type DetectorPlan = {
  inserts: OpenBankLine[];
  refresh: { row: ControlFindingRow; line: OpenBankLine }[];
  reopens: { row: ControlFindingRow; line: OpenBankLine }[];
  closes: ControlFindingRow[];
};

/** Pure diff between the stored findings of this kind and the lines open now. */
export function planUnmatchedFindings(existing: ControlFindingRow[], lines: OpenBankLine[]): DetectorPlan {
  const rows = existing.filter((r) => r.kind === UNMATCHED_BANK_LINE_KIND && r.subjectKind === "bank_transaction");
  const byId = new Map(rows.map((r) => [r.subjectId, r]));
  const seen = new Set<string>();
  const plan: DetectorPlan = { inserts: [], refresh: [], reopens: [], closes: [] };
  for (const line of lines) {
    if (seen.has(line.bankTransactionId)) continue;
    seen.add(line.bankTransactionId);
    const row = byId.get(line.bankTransactionId);
    if (!row) plan.inserts.push(line);
    else if (row.status === "closed") plan.reopens.push({ row, line });
    else plan.refresh.push({ row, line });
  }
  for (const row of rows) {
    if (row.status === "open" && !seen.has(row.subjectId)) plan.closes.push(row);
  }
  return plan;
}

/**
 * Bank lines whose earliest variance row is still open and whose posting
 * date is at least dueDays old as of the clock, with the age in days.
 */
export async function listOpenBankLines(
  db: AppDb,
  tenantId: string,
  now: Date,
  dueDays: number = MATCH_DUE_DAYS
): Promise<OpenBankLine[]> {
  const asOf = now.toISOString().slice(0, 10);
  const cohortEnd = windowStartFor(asOf, dueDays);
  const rows = await db
    .select({
      bankTransactionId: bankTransactions.id,
      bankAccountId: bankTransactions.bankAccountId,
      postedDate: bankTransactions.postedDate,
      amountCents: bankTransactions.amountCents,
      description: bankTransactions.description,
      status: reconciliationVariances.status,
      runId: reconciliationRuns.id,
      runCreatedAt: reconciliationRuns.createdAt,
    })
    .from(bankTransactions)
    .innerJoin(reconciliationVariances, eq(reconciliationVariances.bankTransactionId, bankTransactions.id))
    .innerJoin(reconciliationRuns, eq(reconciliationRuns.id, reconciliationVariances.runId))
    .where(and(eq(bankTransactions.tenantId, tenantId), lte(bankTransactions.postedDate, cohortEnd)))
    .orderBy(sql`${reconciliationRuns.createdAt} asc`);

  const first = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!first.has(row.bankTransactionId)) first.set(row.bankTransactionId, row);

  const open: OpenBankLine[] = [];
  for (const row of first.values()) {
    if (row.status !== "open") continue;
    const postedDate = String(row.postedDate);
    open.push({
      bankTransactionId: row.bankTransactionId,
      bankAccountId: row.bankAccountId,
      runId: row.runId,
      postedDate,
      amountCents: Number(row.amountCents),
      description: row.description,
      ageDays: Math.max(0, daysBetween(postedDate, asOf)),
    });
  }
  return open;
}

export type DetectorRefreshSummary = {
  kind: string;
  inserted: number;
  refreshed: number;
  reopened: number;
  closed: number;
  open: number;
};

/** Applies the unmatched-bank-line plan for one tenant inside the caller's transaction. */
export async function refreshUnmatchedBankLineFindings(
  db: AppDb,
  tenantId: string,
  now: Date = new Date()
): Promise<DetectorRefreshSummary> {
  const existing = await db
    .select()
    .from(controlFindings)
    .where(and(eq(controlFindings.tenantId, tenantId), eq(controlFindings.kind, UNMATCHED_BANK_LINE_KIND)));
  const lines = await listOpenBankLines(db, tenantId, now);
  const plan = planUnmatchedFindings(existing, lines);

  for (const line of plan.inserts) {
    await db.insert(controlFindings).values({
      id: uuidv7(now.getTime()),
      tenantId,
      kind: UNMATCHED_BANK_LINE_KIND,
      subjectKind: "bank_transaction",
      subjectId: line.bankTransactionId,
      severity: severityForAge(line.ageDays),
      status: "open",
      detail: lineDetail(line),
      detectorVersion: DETECTOR_VERSION,
      firstSeenAt: now,
      lastSeenAt: now,
      closedAt: null,
      closedReason: null,
      reopenedCount: 0,
    });
  }
  for (const { row, line } of plan.refresh) {
    await db
      .update(controlFindings)
      .set({ severity: severityForAge(line.ageDays), detail: lineDetail(line), detectorVersion: DETECTOR_VERSION, lastSeenAt: now })
      .where(and(eq(controlFindings.id, row.id), eq(controlFindings.tenantId, tenantId)));
  }
  for (const { row, line } of plan.reopens) {
    await db
      .update(controlFindings)
      .set({
        status: "open",
        closedAt: null,
        closedReason: null,
        reopenedCount: row.reopenedCount + 1,
        severity: severityForAge(line.ageDays),
        detail: lineDetail(line),
        detectorVersion: DETECTOR_VERSION,
        lastSeenAt: now,
      })
      .where(and(eq(controlFindings.id, row.id), eq(controlFindings.tenantId, tenantId)));
  }
  for (const row of plan.closes) {
    await db
      .update(controlFindings)
      .set({ status: "closed", closedAt: now, closedReason: "matched or cleared" })
      .where(and(eq(controlFindings.id, row.id), eq(controlFindings.tenantId, tenantId)));
  }

  return {
    kind: UNMATCHED_BANK_LINE_KIND,
    inserted: plan.inserts.length,
    refreshed: plan.refresh.length,
    reopened: plan.reopens.length,
    closed: plan.closes.length,
    open: plan.inserts.length + plan.refresh.length + plan.reopens.length,
  };
}

/** Every detector the product runs, in order. Called wherever a snapshot is frozen. */
export async function runDetectors(db: AppDb, tenantId: string, now: Date = new Date()): Promise<DetectorRefreshSummary[]> {
  return [await refreshUnmatchedBankLineFindings(db, tenantId, now)];
}

export async function listControlFindings(db: AppDb, tenantId: string): Promise<ControlFindingRow[]> {
  return db
    .select()
    .from(controlFindings)
    .where(eq(controlFindings.tenantId, tenantId))
    .orderBy(sql`${controlFindings.status} asc, ${controlFindings.severity} desc, ${controlFindings.firstSeenAt} asc`);
}

export async function countOpenControlFindings(db: AppDb, tenantId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(controlFindings)
    .where(and(eq(controlFindings.tenantId, tenantId), eq(controlFindings.status, "open")));
  return Number(rows[0]?.n ?? 0);
}
