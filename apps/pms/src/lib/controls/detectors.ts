import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  activeDecisions,
  DECISION_KIND_LABEL,
  ENTITLEMENTS,
  latestDecisionFor,
  type ControlDecision,
  type DualReleasePolicy,
} from "@pms/controls-engine";
import { bankTransactions, controlFindings, deposits, ledgerEntries, reconciliationRuns, reconciliationVariances, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { listDecisions } from "./decisions";
import { MATCH_DUE_DAYS, daysBetween } from "./matchingMeasure";
import { loadActivePolicy } from "./policy";
import { RECONCILIATION_WINDOW_DAYS, windowStartFor } from "./reconciliationMeasure";
import { loadStaff, type LoadedStaff } from "./staff";

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
 * - release_without_approval: a ledger entry in a guarded channel above the
 *   active policy's threshold that cites neither an approved request nor a
 *   policy exception. The database trigger (Increment 1.13) should make
 *   this impossible, so docs/05 calls it a chain-integrity alarm. Judged
 *   against the active policy over every row; closes only when the policy
 *   no longer holds that amount to dual release.
 * - backdated_posting: a reversal, adjustment, or write-off posted more
 *   than BACKDATE_DAYS after its effective date, inside the 45-day window
 *   on the posting date. Closes when the row leaves the window.
 * - duplicate_patient_payment: two or more patient payments on one account
 *   with the same amount and effective date, neither reversed, inside the
 *   window; the later entries carry the finding. Closes when one is
 *   reversed or the rows leave the window.
 * - deposit_not_banked: a deposit the practice prepared, at least
 *   DEPOSIT_BANK_DAYS old and inside the window, that no imported bank
 *   credit has matched (docs/05 "deposit-batch vs bank gaps"). Closes when
 *   a bank credit matches it or it leaves the window.
 * - sole_holder_critical_duty: a duty of the highest risk weight held live
 *   by exactly one active person (docs/05 "sole ownership of a critical
 *   process"). Closes when a second holder is live or none is.
 * - posting_into_sealed_day: a first posting the database stamped against a
 *   day the practice had already frozen (Increment 1.40), inside the 45-day
 *   window on the posting date. Halves of a correction are excluded: a
 *   correction names the entry it replaces and carries its own reason, while
 *   a first posting into a sealed day names nothing. Closes when the row
 *   leaves the window.
 */
export const DETECTOR_VERSION = "detectors-v5";
export const UNMATCHED_BANK_LINE_KIND = "unmatched_bank_line_48h";
export const DEGRADED_CLEARANCE_KIND = "degraded_owner_clearance";
export const DECISION_UNREVIEWED_KIND = "decision_unreviewed";
export const RELEASE_WITHOUT_APPROVAL_KIND = "release_without_approval";
export const BACKDATED_POSTING_KIND = "backdated_posting";
export const DUPLICATE_PAYMENT_KIND = "duplicate_patient_payment";
export const DEPOSIT_NOT_BANKED_KIND = "deposit_not_banked";
export const SOLE_HOLDER_KIND = "sole_holder_critical_duty";
export const SEALED_DAY_POSTING_KIND = "posting_into_sealed_day";

export const FINDING_KIND_LABEL: Record<string, string> = {
  [UNMATCHED_BANK_LINE_KIND]: "Unmatched bank line older than 48 hours",
  [DEGRADED_CLEARANCE_KIND]: "Owner-only clearance",
  [DECISION_UNREVIEWED_KIND]: "Decision past its review date",
  [RELEASE_WITHOUT_APPROVAL_KIND]: "Release above threshold without approval",
  [BACKDATED_POSTING_KIND]: "Posting dated well before it was posted",
  [DUPLICATE_PAYMENT_KIND]: "Duplicate patient payment",
  [DEPOSIT_NOT_BANKED_KIND]: "Deposit not yet at the bank",
  [SOLE_HOLDER_KIND]: "Critical duty held by one person",
  [SEALED_DAY_POSTING_KIND]: "First posting into a day already sealed",
};

export type ControlFindingRow = typeof controlFindings.$inferSelect;
export type FindingSeverity = "low" | "medium" | "high";
export type FindingSubjectKind = "bank_transaction" | "reconciliation_run" | "control_decision" | "ledger_entry" | "deposit" | "entitlement";

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
  return `A "${DECISION_KIND_LABEL[d.kind]}" decision on ${d.subjectKind.replace(/_/g, " ")} ${d.subjectId} was due for review on ${d.reviewBy} and has been past that date for ${d.daysOverdue} day${d.daysOverdue === 1 ? "" : "s"}. It no longer governs: the subject reads as undecided until a new decision is recorded.`;
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
// Detectors 4 to 6: ledger rows
// ---------------------------------------------------------------------------

export type LedgerEntryFacts = {
  id: string;
  accountId: string;
  kind: string;
  amountCents: number;
  /** YYYY-MM-DD. */
  effectiveDate: string;
  /** YYYY-MM-DD, from posted_at. */
  postedOn: string;
  approvalRequestId: string | null;
  appliedExceptionId: string | null;
  reversesEntryId: string | null;
  /** Set on both halves of a correction pair; null on a first posting (Increment 1.37). */
  correctsEntryId: string | null;
  /** The frozen day close this row landed behind, written by the database (Increment 1.40). */
  closedDayId: string | null;
};

/** The same map the Increment 1.13 trigger uses (ledger_release_channel). */
export const LEDGER_RELEASE_CHANNEL: Record<string, string> = {
  adjustment: "writeoff",
  write_off: "writeoff",
  reversal: "writeoff",
  refund: "check",
  transfer_out: "ach",
  transfer_in: "ach",
};

const KIND_WORD: Record<string, string> = {
  adjustment: "adjustment",
  write_off: "write-off",
  reversal: "reversal",
  refund: "refund",
  transfer_out: "transfer out",
  transfer_in: "transfer in",
  patient_payment: "patient payment",
};

function kindWord(kind: string): string {
  return KIND_WORD[kind] ?? kind.replace(/_/g, " ");
}

/**
 * Entries in a guarded channel above the active threshold with neither an
 * approved request nor a policy exception. Mirrors the trigger's floor: the
 * master switch and the channel rule must be enabled, and the amount must
 * exceed the rule's threshold. Exceptions that raise a threshold are
 * recorded on the row as applied_exception_id when they license a release,
 * so a row without one above the base threshold is the alarm.
 */
export function releaseWithoutApprovalCandidates(entries: LedgerEntryFacts[], policy: DualReleasePolicy | null): FindingCandidate[] {
  if (!policy || !policy.enabled) return [];
  const out: FindingCandidate[] = [];
  for (const e of entries) {
    const channel = LEDGER_RELEASE_CHANNEL[e.kind];
    if (!channel) continue;
    const rule = policy.rules.find((r) => r.channel === channel);
    if (!rule || !rule.enabled) continue;
    const thresholdCents = Math.round(rule.thresholdUsd * 100);
    if (Math.abs(e.amountCents) <= thresholdCents) continue;
    if (e.approvalRequestId || e.appliedExceptionId) continue;
    out.push({
      subjectId: e.id,
      severity: "high",
      detail: {
        kind: e.kind,
        channel,
        amountCents: e.amountCents,
        thresholdUsd: rule.thresholdUsd,
        effectiveDate: e.effectiveDate,
        postedOn: e.postedOn,
        accountId: e.accountId,
        sentence: `A ${money(e.amountCents)} ${kindWord(e.kind)} posted ${e.postedOn} cites neither an approved request nor a policy exception, and the active policy holds the ${channel} channel to dual release above ${money(thresholdCents)}. The database trigger should have refused this row; treat it as a chain-integrity alarm.`,
      },
    });
  }
  return out;
}

export const BACKDATE_DAYS = 7;
const BACKDATED_KINDS = new Set(["reversal", "adjustment", "write_off"]);

/** A month or less between effective and posted is medium; more is high. */
export function severityForBackdate(daysBack: number): FindingSeverity {
  return daysBack <= 30 ? "medium" : "high";
}

/** Reversals, adjustments, and write-offs posted more than BACKDATE_DAYS after their effective date. */
export function backdatedPostingCandidates(entries: LedgerEntryFacts[], backdateDays: number = BACKDATE_DAYS): FindingCandidate[] {
  const out: FindingCandidate[] = [];
  for (const e of entries) {
    if (!BACKDATED_KINDS.has(e.kind)) continue;
    const daysBack = daysBetween(e.effectiveDate, e.postedOn);
    if (daysBack <= backdateDays) continue;
    out.push({
      subjectId: e.id,
      severity: severityForBackdate(daysBack),
      detail: {
        kind: e.kind,
        amountCents: e.amountCents,
        effectiveDate: e.effectiveDate,
        postedOn: e.postedOn,
        daysBack,
        accountId: e.accountId,
        sentence: `A ${money(e.amountCents)} ${kindWord(e.kind)} effective ${e.effectiveDate} was posted on ${e.postedOn}, ${daysBack} days after its effective date.`,
      },
    });
  }
  return out;
}

/**
 * Two or more patient payments on one account with the same amount and
 * effective date, none of them reversed. The first (by posting time) stands;
 * each later one carries the finding, so a genuine second payment on the
 * same day is one row to look at, not an accusation.
 */
export function duplicatePaymentCandidates(entries: LedgerEntryFacts[]): FindingCandidate[] {
  const reversed = new Set(entries.map((e) => e.reversesEntryId).filter((id): id is string => Boolean(id)));
  const groups = new Map<string, LedgerEntryFacts[]>();
  for (const e of entries) {
    if (e.kind !== "patient_payment" || reversed.has(e.id)) continue;
    const key = `${e.accountId}|${e.amountCents}|${e.effectiveDate}`;
    const g = groups.get(key) ?? [];
    g.push(e);
    groups.set(key, g);
  }
  const out: FindingCandidate[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => (a.postedOn < b.postedOn ? -1 : a.postedOn > b.postedOn ? 1 : a.id < b.id ? -1 : 1));
    const first = sorted[0]!;
    for (const e of sorted.slice(1)) {
      out.push({
        subjectId: e.id,
        severity: "low",
        detail: {
          amountCents: e.amountCents,
          effectiveDate: e.effectiveDate,
          accountId: e.accountId,
          firstEntryId: first.id,
          count: g.length,
          sentence: `${g.length} patient payments of ${money(e.amountCents)} on one account carry the effective date ${e.effectiveDate}, and none has been reversed. This row is the later one; the first stands as posted.`,
        },
      });
    }
  }
  return out;
}

/**
 * One sealed day taking more than one first posting is a pattern rather
 * than a slip, and the severity says which.
 */
export function severityForSealedDayPostings(rowsOnThatDay: number): FindingSeverity {
  return rowsOnThatDay > 1 ? "high" : "medium";
}

/**
 * First postings the database stamped against a day the practice had already
 * frozen (Increment 1.40).
 *
 * Halves of a correction are left out on purpose. A correction names the
 * entry it replaces, carries a reason, and above the threshold waits for a
 * second person; it announces itself. A first posting into a sealed day
 * announces nothing, which is the whole reason to raise it.
 *
 * The row's effective date is the sealed day's business date: the trigger
 * stamps a row only where a frozen close carries that date for that
 * location, so no join is needed to name the day.
 */
export function sealedDayPostingCandidates(entries: LedgerEntryFacts[]): FindingCandidate[] {
  const late = entries.filter((e) => e.closedDayId !== null && e.correctsEntryId === null);
  const perDay = new Map<string, number>();
  for (const e of late) perDay.set(e.closedDayId!, (perDay.get(e.closedDayId!) ?? 0) + 1);

  return late.map((e) => {
    const onThatDay = perDay.get(e.closedDayId!) ?? 1;
    const company =
      onThatDay > 1
        ? ` ${onThatDay} first postings have landed behind that seal.`
        : "";
    return {
      subjectId: e.id,
      severity: severityForSealedDayPostings(onThatDay),
      detail: {
        kind: e.kind,
        amountCents: e.amountCents,
        sealedDay: e.effectiveDate,
        postedOn: e.postedOn,
        closedDayId: e.closedDayId,
        postingsBehindThatSeal: onThatDay,
        accountId: e.accountId,
        sentence: `A ${money(e.amountCents)} ${kindWord(e.kind)} posted ${e.postedOn} landed against ${e.effectiveDate}, a day the practice had already sealed. The sealed figures do not move, so that day's count and that day's ledger now differ.${company}`,
      },
    };
  });
}

async function listLedgerFacts(db: AppDb, tenantId: string, since: Date | null, kinds: string[] | null): Promise<LedgerEntryFacts[]> {
  const filters = [eq(ledgerEntries.tenantId, tenantId)];
  if (since) filters.push(gte(ledgerEntries.postedAt, since));
  if (kinds) filters.push(inArray(ledgerEntries.kind, kinds));
  const rows = await db
    .select({
      id: ledgerEntries.id,
      accountId: ledgerEntries.accountId,
      kind: ledgerEntries.kind,
      amountCents: ledgerEntries.amountCents,
      effectiveDate: ledgerEntries.effectiveDate,
      postedAt: ledgerEntries.postedAt,
      approvalRequestId: ledgerEntries.approvalRequestId,
      appliedExceptionId: ledgerEntries.appliedExceptionId,
      reversesEntryId: ledgerEntries.reversesEntryId,
      correctsEntryId: ledgerEntries.correctsEntryId,
      closedDayId: ledgerEntries.closedDayId,
    })
    .from(ledgerEntries)
    .where(and(...filters));
  return rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    kind: r.kind,
    amountCents: Number(r.amountCents),
    effectiveDate: String(r.effectiveDate),
    postedOn: r.postedAt.toISOString().slice(0, 10),
    approvalRequestId: r.approvalRequestId,
    appliedExceptionId: r.appliedExceptionId,
    reversesEntryId: r.reversesEntryId,
    correctsEntryId: r.correctsEntryId,
    closedDayId: r.closedDayId,
  }));
}

export async function refreshLedgerFindings(db: AppDb, tenantId: string, now: Date = new Date()): Promise<DetectorRefreshSummary[]> {
  const asOf = now.toISOString().slice(0, 10);
  const since = new Date(`${windowStartFor(asOf, RECONCILIATION_WINDOW_DAYS)}T00:00:00Z`);
  const windowReason = `outside the ${RECONCILIATION_WINDOW_DAYS}-day window`;

  const active = await loadActivePolicy(db, tenantId);
  const guarded = await listLedgerFacts(db, tenantId, null, Object.keys(LEDGER_RELEASE_CHANNEL));
  const releasePlan = planFindings(
    await existingOfKind(db, tenantId, RELEASE_WITHOUT_APPROVAL_KIND),
    RELEASE_WITHOUT_APPROVAL_KIND,
    "ledger_entry",
    releaseWithoutApprovalCandidates(guarded, active?.policy ?? null)
  );
  const release = await applyPlan(db, tenantId, RELEASE_WITHOUT_APPROVAL_KIND, "ledger_entry", releasePlan, "below the active threshold or licensed", now);

  const recent = await listLedgerFacts(db, tenantId, since, null);
  const backdatedPlan = planFindings(await existingOfKind(db, tenantId, BACKDATED_POSTING_KIND), BACKDATED_POSTING_KIND, "ledger_entry", backdatedPostingCandidates(recent));
  const backdated = await applyPlan(db, tenantId, BACKDATED_POSTING_KIND, "ledger_entry", backdatedPlan, windowReason, now);

  // Reversals may sit outside the window while the payments they reverse sit inside it, so reversal
  // rows are read without the window and merged in for the exclusion only.
  const reversals = await listLedgerFacts(db, tenantId, null, ["reversal"]);
  const duplicatePlan = planFindings(
    await existingOfKind(db, tenantId, DUPLICATE_PAYMENT_KIND),
    DUPLICATE_PAYMENT_KIND,
    "ledger_entry",
    duplicatePaymentCandidates([...recent.filter((e) => e.kind === "patient_payment"), ...reversals])
  );
  const duplicates = await applyPlan(db, tenantId, DUPLICATE_PAYMENT_KIND, "ledger_entry", duplicatePlan, `reversed or ${windowReason}`, now);

  const sealedPlan = planFindings(
    await existingOfKind(db, tenantId, SEALED_DAY_POSTING_KIND),
    SEALED_DAY_POSTING_KIND,
    "ledger_entry",
    sealedDayPostingCandidates(recent)
  );
  const sealed = await applyPlan(db, tenantId, SEALED_DAY_POSTING_KIND, "ledger_entry", sealedPlan, windowReason, now);

  return [release, backdated, duplicates, sealed];
}

// ---------------------------------------------------------------------------
// Detector 7: deposits with no bank credit after the banking lag
// ---------------------------------------------------------------------------

/** Calendar days a deposit gets to appear on a bank statement before it counts as a gap. */
export const DEPOSIT_BANK_DAYS = 5;

export type DepositFacts = {
  depositId: string;
  bankAccountId: string;
  /** YYYY-MM-DD. */
  businessDate: string;
  method: string;
  amountCents: number;
  reference: string | null;
  /** True when a matched_deposit variance row cites this deposit. */
  matched: boolean;
};

/** Two weeks or less is medium; longer is high. */
export function severityForBankingGap(ageDays: number): FindingSeverity {
  return ageDays <= 14 ? "medium" : "high";
}

/**
 * Deposits prepared at least dueDays ago that no imported bank credit has
 * matched. The caller bounds the rows to the window; the age is measured
 * from the business date.
 */
export function depositNotBankedCandidates(depositRows: DepositFacts[], asOf: string, dueDays: number = DEPOSIT_BANK_DAYS): FindingCandidate[] {
  const out: FindingCandidate[] = [];
  for (const d of depositRows) {
    if (d.matched) continue;
    const ageDays = daysBetween(d.businessDate, asOf);
    if (ageDays < dueDays) continue;
    out.push({
      subjectId: d.depositId,
      severity: severityForBankingGap(ageDays),
      detail: {
        bankAccountId: d.bankAccountId,
        businessDate: d.businessDate,
        method: d.method,
        amountCents: d.amountCents,
        reference: d.reference,
        ageDays,
        sentence: `A ${money(d.amountCents)} ${d.method.toLowerCase()} deposit prepared for ${d.businessDate} has no matching bank credit after ${ageDays} day${ageDays === 1 ? "" : "s"}.`,
      },
    });
  }
  return out;
}

/** Deposits whose business date falls inside the window, with whether a matched bank line cites each. */
export async function listDepositFacts(db: AppDb, tenantId: string, now: Date, windowDays: number = RECONCILIATION_WINDOW_DAYS): Promise<DepositFacts[]> {
  const asOf = now.toISOString().slice(0, 10);
  const windowStart = windowStartFor(asOf, windowDays);
  const rows = await db
    .select({
      id: deposits.id,
      bankAccountId: deposits.bankAccountId,
      businessDate: deposits.businessDate,
      method: deposits.method,
      amountCents: deposits.amountCents,
      reference: deposits.reference,
    })
    .from(deposits)
    .where(and(eq(deposits.tenantId, tenantId), gte(deposits.businessDate, windowStart)));
  const matchedRows = await db
    .select({ matchRef: reconciliationVariances.matchRef })
    .from(reconciliationVariances)
    .where(and(eq(reconciliationVariances.tenantId, tenantId), eq(reconciliationVariances.kind, "matched_deposit")));
  const matched = new Set<string>();
  for (const row of matchedRows) {
    const ref = (row.matchRef ?? {}) as { depositId?: string };
    if (ref.depositId) matched.add(ref.depositId);
  }
  return rows.map((r) => ({
    depositId: r.id,
    bankAccountId: r.bankAccountId,
    businessDate: String(r.businessDate),
    method: r.method,
    amountCents: Number(r.amountCents),
    reference: r.reference,
    matched: matched.has(r.id),
  }));
}

export async function refreshDepositNotBankedFindings(db: AppDb, tenantId: string, now: Date = new Date()): Promise<DetectorRefreshSummary> {
  const asOf = now.toISOString().slice(0, 10);
  const existing = await existingOfKind(db, tenantId, DEPOSIT_NOT_BANKED_KIND);
  const plan = planFindings(existing, DEPOSIT_NOT_BANKED_KIND, "deposit", depositNotBankedCandidates(await listDepositFacts(db, tenantId, now), asOf));
  return applyPlan(db, tenantId, DEPOSIT_NOT_BANKED_KIND, "deposit", plan, `matched at the bank or outside the ${RECONCILIATION_WINDOW_DAYS}-day window`, now);
}

// ---------------------------------------------------------------------------
// Detector 8: a critical duty held by one person
// ---------------------------------------------------------------------------

/** The duties whose loss or misuse the rulebook weights highest. */
export const CRITICAL_DUTY_WEIGHT = 5;
export const CRITICAL_DUTIES = ENTITLEMENTS.filter((e) => e.riskWeight >= CRITICAL_DUTY_WEIGHT).map((e) => e.id as string);

export type DutyHolders = { entitlement: string; activeHolders: number };

/** Live holders per duty among active people, from the staff loader's rows. */
export function dutyHolders(staff: Pick<LoadedStaff, "rows">): DutyHolders[] {
  const counts = new Map<string, Set<string>>();
  for (const row of staff.rows) {
    if (!row.active) continue;
    for (const e of row.entitlements) {
      const set = counts.get(e) ?? new Set<string>();
      set.add(row.id);
      counts.set(e, set);
    }
  }
  return CRITICAL_DUTIES.map((entitlement) => ({ entitlement, activeHolders: counts.get(entitlement)?.size ?? 0 }));
}

export function soleHolderCandidates(holders: DutyHolders[]): FindingCandidate[] {
  const labels = new Map(ENTITLEMENTS.map((e) => [e.id as string, e.label]));
  return holders
    .filter((h) => h.activeHolders === 1)
    .map((h) => ({
      subjectId: h.entitlement,
      severity: "medium" as const,
      detail: {
        entitlement: h.entitlement,
        label: labels.get(h.entitlement) ?? h.entitlement,
        activeHolders: 1,
        sentence: `"${labels.get(h.entitlement) ?? h.entitlement}" is held by one active person only. If that person is away, no one can perform it and no one can check it: the practice depends on one set of hands for this duty.`,
      },
    }));
}

export async function refreshSoleHolderFindings(db: AppDb, tenantId: string, now: Date = new Date(), staff?: LoadedStaff): Promise<DetectorRefreshSummary> {
  const existing = await existingOfKind(db, tenantId, SOLE_HOLDER_KIND);
  const loaded = staff ?? (await loadStaff(db, tenantId, now));
  const plan = planFindings(existing, SOLE_HOLDER_KIND, "entitlement", soleHolderCandidates(dutyHolders(loaded)));
  return applyPlan(db, tenantId, SOLE_HOLDER_KIND, "entitlement", plan, "a second holder is live, or none is", now);
}

// ---------------------------------------------------------------------------

/** Every detector the product runs, in order. Called wherever a snapshot is frozen. */
export async function runDetectors(
  db: AppDb,
  tenantId: string,
  now: Date = new Date(),
  context?: { decisions?: ControlDecision[]; staff?: LoadedStaff }
): Promise<DetectorRefreshSummary[]> {
  return [
    await refreshUnmatchedBankLineFindings(db, tenantId, now),
    await refreshDegradedClearanceFindings(db, tenantId, now),
    await refreshUnreviewedDecisionFindings(db, tenantId, now, context?.decisions),
    ...(await refreshLedgerFindings(db, tenantId, now)),
    await refreshDepositNotBankedFindings(db, tenantId, now),
    await refreshSoleHolderFindings(db, tenantId, now, context?.staff),
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

// ---------------------------------------------------------------------------
// Decisions on findings (Increment 1.26)
// ---------------------------------------------------------------------------

/**
 * The active decision that governs a finding: the latest one whose subject
 * is this row and that no later decision has superseded. The detectors keep
 * owning the row's status; the decision records what the owner made of it.
 */
export function governingFindingDecision(findingId: string, decisions: ControlDecision[]): ControlDecision | undefined {
  return latestDecisionFor(decisions, "detector_finding", findingId);
}

export type FindingsSummary = {
  open: number;
  closed: number;
  high: number;
  medium: number;
  low: number;
  /** Open findings that carry an active decision. */
  decided: number;
  /** Open findings that carry none: the rows still waiting for the owner. */
  undecided: number;
};

/** Counts over the rows as stored, with the open ones split by whether a decision governs them. */
export function summarizeFindings(
  rows: Pick<ControlFindingRow, "id" | "status" | "severity">[],
  decisions: ControlDecision[]
): FindingsSummary {
  const open = rows.filter((r) => r.status === "open");
  const decided = open.filter((r) => governingFindingDecision(r.id, decisions) !== undefined).length;
  return {
    open: open.length,
    closed: rows.length - open.length,
    high: open.filter((r) => r.severity === "high").length,
    medium: open.filter((r) => r.severity === "medium").length,
    low: open.filter((r) => r.severity === "low").length,
    decided,
    undecided: open.length - decided,
  };
}
