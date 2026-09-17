import { and, eq, gte, lte, sql } from "drizzle-orm";
import { activeDecisions, DECISION_KIND_LABEL, type ControlDecision } from "@pms/controls-engine";
import { bankTransactions, controlFindings, reconciliationRuns, reconciliationVariances, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { listDecisions } from "./decisions";
import { MATCH_DUE_DAYS, daysBetween } from "./matchingMeasure";
import { RECONCILIATION_WINDOW_DAYS, windowStartFor } from "./reconciliationMeasure";

/**
 * Detectors (docs/05: "recorded, batched"). A detector reads live rows and
 * keeps one control_findings row per (kind, subject): opened when the
 * condition holds, refreshed while it holds, closed with a reason when it
 * clears, reopened on recurrence, never deleted. The detail is a flat
 * object of facts about the subject; the sentence describes a line, a
 * run, or a decision and the process, never a person, so no output reads
 * as an accusation.
 *
 * Three detectors run today, on the same clock, wherever a snapshot is
 * frozen (the nightly job and every manual freeze):
 *
 * - unmatched_bank_line_48h: a bank line the practice holds that has had no
 *   matching deposit and no clearance for more than 48 hours since the bank
 *   posted it. The earliest run that carried a line decides whether it is
 *   still open, so a statement imported twice does not reopen what the
 *   first run cleared. Closes when the line matches or its run clears.
 * - degraded_owner_clearance: a reconciliation run cleared as owner-only
 *   clearance (no other eligible person existed) inside the 45-day
 *   measurement window. docs/05: "the degraded state is itself a finding".
 *   Closes when the run leaves the window.
 * - decision_unreviewed: an active control decision whose review date has
 *   passed (docs/13 item 21: "an unreviewed decision becomes a
 *   control_finding"). Closes when the decision is superseded.
 */
export const DETECTOR_VERSION = "detectors-v2";
export const UNMATCHED_BANK_LINE_KIND = "unmatched_bank_line_48h";
export const DEGRADED_CLEARANCE_KIND = "degraded_owner_clearance";
export const DECISION_UNREVIEWED_KIND = "decision_unreviewed";

export const FINDING_KIND_LABEL: Record<string, string> = {
  [UNMATCHED_BANK_LINE_KIND]: "Unmatched bank line older than 48 hours",
  [DEGRADED_CLEARANCE_KIND]: "Owner-only clearance",
  [DECISION_UNREVIEWED_KIND]: "Decision past its review date",
};

export type ControlFindingRow = typeof controlFindings.$inferSelect;
export type FindingSeverity = "low" | "medium" | "high";
export type FindingSubjectKind = "bank_transaction" | "reconciliation_run" | "control_decision";

/** What a detector proposes for one subject: the row it would write, minus bookkeeping. */
export type FindingCandidate = {
  subjectId: string;
  severity: FindingSeverity;
  detail: Record<string, string | number | boolean | null>;
};

export type DetectorPlan = {
  inserts: FindingCandidate[];
  refresh: { row: ControlFindingRow; candidate: FindingCandidate }[];
  reopens: { row: ControlFindingRow; candidate: FindingCandidate }[];
  closes: ControlFindingRow[];
};

/**
 * Pure diff between the stored findings of one kind and the candidates a
 * detector sees now: open the new, refresh the still-open, reopen a closed
 * one that recurs, close the rest.
 */
export function planFindings(
  existing: ControlFindingRow[],
  kind: string,
  subjectKind: FindingSubjectKind,
  candidates: FindingCandidate[]
): DetectorPlan {
  const rows = existing.filter((r) => r.kind === kind && r.subjectKind === subjectKind);
  const byId = new Map(rows.map((r) => [r.subjectId, r]));
  const seen = new Set<string>();
  const plan: DetectorPlan = { inserts: [], refresh: [], reopens: [], closes: [] };
  for (const candidate of candidates) {
    if (seen.has(candidate.subjectId)) continue;
    seen.add(candidate.subjectId);
    const row = byId.get(candidate.subjectId);
    if (!row) plan.inserts.push(candidate);
    else if (row.status === "closed") plan.reopens.push({ row, candidate });
    else plan.refresh.push({ row, candidate });
  }
  for (const row of rows) {
    if (row.status === "open" && !seen.has(row.subjectId)) plan.closes.push(row);
  }
  return plan;
}

export type DetectorRefreshSummary = {
  kind: string;
  inserted: number;
  refreshed: number;
  reopened: number;
  closed: number;
  open: number;
};

/** Writes one detector's plan inside the caller's transaction. */
async function applyPlan(
  db: AppDb,
  tenantId: string,
  kind: string,
  subjectKind: FindingSubjectKind,
  plan: DetectorPlan,
  closedReason: string,
  now: Date
): Promise<DetectorRefreshSummary> {
  for (const c of plan.inserts) {
    await db.insert(controlFindings).values({
      id: uuidv7(now.getTime()),
      tenantId,
      kind,
      subjectKind,
      subjectId: c.subjectId,
      severity: c.severity,
      status: "open",
      detail: c.detail,
      detectorVersion: DETECTOR_VERSION,
      firstSeenAt: now,
      lastSeenAt: now,
      closedAt: null,
      closedReason: null,
      reopenedCount: 0,
    });
  }
  for (const { row, candidate: c } of plan.refresh) {
    await db
      .update(controlFindings)
      .set({ severity: c.severity, detail: c.detail, detectorVersion: DETECTOR_VERSION, lastSeenAt: now })
      .where(and(eq(controlFindings.id, row.id), eq(controlFindings.tenantId, tenantId)));
  }
  for (const { row, candidate: c } of plan.reopens) {
    await db
      .update(controlFindings)
      .set({
        status: "open",
        closedAt: null,
        closedReason: null,
        reopenedCount: row.reopenedCount + 1,
        severity: c.severity,
        detail: c.detail,
        detectorVersion: DETECTOR_VERSION,
        lastSeenAt: now,
      })
      .where(and(eq(controlFindings.id, row.id), eq(controlFindings.tenantId, tenantId)));
  }
  for (const row of plan.closes) {
    await db
      .update(controlFindings)
      .set({ status: "closed", closedAt: now, closedReason })
      .where(and(eq(controlFindings.id, row.id), eq(controlFindings.tenantId, tenantId)));
  }
  return {
    kind,
    inserted: plan.inserts.length,
    refreshed: plan.refresh.length,
    reopened: plan.reopens.length,
    closed: plan.closes.length,
    open: plan.inserts.length + plan.refresh.length + plan.reopens.length,
  };
}

async function existingOfKind(db: AppDb, tenantId: string, kind: string): Promise<ControlFindingRow[]> {
  return db
    .select()
    .from(controlFindings)
    .where(and(eq(controlFindings.tenantId, tenantId), eq(controlFindings.kind, kind)));
}

function money(cents: number): string {
  const abs = Math.abs(cents);
  return `$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Detector 1: unmatched bank lines older than 48 hours
// ---------------------------------------------------------------------------

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

/** One sentence about the line and the process. Names no one. */
export function lineSentence(line: OpenBankLine): string {
  const kind = line.amountCents > 0 ? "credit" : "debit";
  return `A ${money(line.amountCents)} bank ${kind} posted ${line.postedDate} (${line.description}) has had no matching deposit and no clearance for ${line.ageDays} day${line.ageDays === 1 ? "" : "s"}.`;
}

export function lineDetail(line: OpenBankLine): FindingCandidate["detail"] {
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

export function lineCandidate(line: OpenBankLine): FindingCandidate {
  return { subjectId: line.bankTransactionId, severity: severityForAge(line.ageDays), detail: lineDetail(line) };
}

/** Kept for callers and tests that speak in lines rather than candidates. */
export function planUnmatchedFindings(existing: ControlFindingRow[], lines: OpenBankLine[]): DetectorPlan & { insertedLines: OpenBankLine[] } {
  const plan = planFindings(existing, UNMATCHED_BANK_LINE_KIND, "bank_transaction", lines.map(lineCandidate));
  const byId = new Map(lines.map((l) => [l.bankTransactionId, l]));
  return { ...plan, insertedLines: plan.inserts.map((c) => byId.get(c.subjectId)!) };
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

export async function refreshUnmatchedBankLineFindings(db: AppDb, tenantId: string, now: Date = new Date()): Promise<DetectorRefreshSummary> {
  const existing = await existingOfKind(db, tenantId, UNMATCHED_BANK_LINE_KIND);
  const lines = await listOpenBankLines(db, tenantId, now);
  const plan = planFindings(existing, UNMATCHED_BANK_LINE_KIND, "bank_transaction", lines.map(lineCandidate));
  return applyPlan(db, tenantId, UNMATCHED_BANK_LINE_KIND, "bank_transaction", plan, "matched or cleared", now);
}

// ---------------------------------------------------------------------------
// Detector 2: owner-only clearance inside the measurement window
// ---------------------------------------------------------------------------

export type DegradedRun = {
  runId: string;
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  /** YYYY-MM-DD the run was cleared. */
  clearedOn: string;
};

export function degradedRunSentence(run: DegradedRun): string {
  return `The reconciliation run for ${run.periodStart} to ${run.periodEnd} was cleared on ${run.clearedOn} as owner-only clearance: no other eligible person existed, so the same hands that recorded or prepared also cleared. The control was not disabled; this row records that it ran degraded.`;
}

export function degradedRunCandidate(run: DegradedRun): FindingCandidate {
  return {
    subjectId: run.runId,
    severity: "medium",
    detail: {
      bankAccountId: run.bankAccountId,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      clearedOn: run.clearedOn,
      sentence: degradedRunSentence(run),
    },
  };
}

/** Runs cleared as owner-only clearance whose clearance falls inside the window. */
export async function listDegradedClearances(
  db: AppDb,
  tenantId: string,
  now: Date,
  windowDays: number = RECONCILIATION_WINDOW_DAYS
): Promise<DegradedRun[]> {
  const asOf = now.toISOString().slice(0, 10);
  const since = new Date(`${windowStartFor(asOf, windowDays)}T00:00:00Z`);
  const rows = await db
    .select({
      runId: reconciliationRuns.id,
      bankAccountId: reconciliationRuns.bankAccountId,
      periodStart: reconciliationRuns.periodStart,
      periodEnd: reconciliationRuns.periodEnd,
      clearedAt: reconciliationRuns.clearedAt,
      summary: reconciliationRuns.summary,
    })
    .from(reconciliationRuns)
    .where(
      and(eq(reconciliationRuns.tenantId, tenantId), eq(reconciliationRuns.status, "cleared"), gte(reconciliationRuns.clearedAt, since))
    );
  return rows
    .filter((r) => (r.summary as { degradedOwnerClearance?: boolean }).degradedOwnerClearance === true && r.clearedAt)
    .map((r) => ({
      runId: r.runId,
      bankAccountId: r.bankAccountId,
      periodStart: String(r.periodStart),
      periodEnd: String(r.periodEnd),
      clearedOn: r.clearedAt!.toISOString().slice(0, 10),
    }));
}

export async function refreshDegradedClearanceFindings(db: AppDb, tenantId: string, now: Date = new Date()): Promise<DetectorRefreshSummary> {
  const existing = await existingOfKind(db, tenantId, DEGRADED_CLEARANCE_KIND);
  const runs = await listDegradedClearances(db, tenantId, now);
  const plan = planFindings(existing, DEGRADED_CLEARANCE_KIND, "reconciliation_run", runs.map(degradedRunCandidate));
  return applyPlan(db, tenantId, DEGRADED_CLEARANCE_KIND, "reconciliation_run", plan, `outside the ${RECONCILIATION_WINDOW_DAYS}-day window`, now);
}

// ---------------------------------------------------------------------------
// Detector 3: active decisions past their review date
// ---------------------------------------------------------------------------

export type OverdueDecision = {
  decisionId: string;
  kind: ControlDecision["kind"];
  subjectKind: string;
  subjectId: string;
  reviewBy: string;
  daysOverdue: number;
};

/** Active decisions whose review date is before asOf, with how many days have passed. */
export function overdueDecisions(decisions: ControlDecision[], asOf: string): OverdueDecision[] {
  return activeDecisions(decisions)
    .filter((d): d is ControlDecision & { reviewBy: string } => d.reviewBy != null && d.reviewBy < asOf)
    .map((d) => ({
      decisionId: d.id,
      kind: d.kind,
      subjectKind: d.subjectKind,
      subjectId: d.subjectId,
      reviewBy: d.reviewBy,
      daysOverdue: daysBetween(d.reviewBy, asOf),
    }));
}

/** A month or less past the date is medium; longer is high. */
export function severityForOverdue(daysOverdue: number): FindingSeverity {
  return daysOverdue <= 30 ? "medium" : "high";
}

export function overdueDecisionSentence(d: OverdueDecision): string {
  return `A "${DECISION_KIND_LABEL[d.kind]}" decision on ${d.subjectKind.replace(/_/g, " ")} ${d.subjectId} was due for review on ${d.reviewBy} and has been past that date for ${d.daysOverdue} day${d.daysOverdue === 1 ? "" : "s"}. It still governs until a new decision supersedes it.`;
}

export function overdueDecisionCandidate(d: OverdueDecision): FindingCandidate {
  return {
    subjectId: d.decisionId,
    severity: severityForOverdue(d.daysOverdue),
    detail: {
      decisionKind: d.kind,
      decisionSubjectKind: d.subjectKind,
      decisionSubjectId: d.subjectId,
      reviewBy: d.reviewBy,
      daysOverdue: d.daysOverdue,
      sentence: overdueDecisionSentence(d),
    },
  };
}

export async function refreshUnreviewedDecisionFindings(
  db: AppDb,
  tenantId: string,
  now: Date = new Date(),
  decisions?: ControlDecision[]
): Promise<DetectorRefreshSummary> {
  const asOf = now.toISOString().slice(0, 10);
  const existing = await existingOfKind(db, tenantId, DECISION_UNREVIEWED_KIND);
  const all = decisions ?? (await listDecisions(db, tenantId));
  const plan = planFindings(existing, DECISION_UNREVIEWED_KIND, "control_decision", overdueDecisions(all, asOf).map(overdueDecisionCandidate));
  return applyPlan(db, tenantId, DECISION_UNREVIEWED_KIND, "control_decision", plan, "superseded", now);
}

// ---------------------------------------------------------------------------

/** Every detector the product runs, in order. Called wherever a snapshot is frozen. */
export async function runDetectors(
  db: AppDb,
  tenantId: string,
  now: Date = new Date(),
  decisions?: ControlDecision[]
): Promise<DetectorRefreshSummary[]> {
  return [
    await refreshUnmatchedBankLineFindings(db, tenantId, now),
    await refreshDegradedClearanceFindings(db, tenantId, now),
    await refreshUnreviewedDecisionFindings(db, tenantId, now, decisions),
  ];
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
