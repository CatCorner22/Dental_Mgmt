import { and, eq } from "drizzle-orm";
import {
  CONTROL_RULEBOOK_VERSION,
  latestDecisionFor,
  type ControlDecision,
  type DetectedConflict,
  type SodDetectionReport,
} from "@pms/controls-engine";
import { sodFindings, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";

export type FindingRow = typeof sodFindings.$inferSelect;

export type FindingsPlan = {
  inserts: DetectedConflict[];
  /** Open rows whose conflict is still detected: refresh score and flags. */
  refresh: { row: FindingRow; conflict: DetectedConflict }[];
  /** Closed rows whose conflict is back. */
  reopens: { row: FindingRow; conflict: DetectedConflict }[];
  /** Open rows whose conflict is gone. */
  closes: FindingRow[];
};

function key(ruleId: string, personId: string): string {
  return `${ruleId}|${personId}`;
}

/**
 * Pure diff between the stored findings and the conflicts detected now.
 * Keyed on (rule, person); a finding is closed, never deleted, and a
 * recurrence reopens the same row so the history stays in one place.
 */
export function planFindingsRefresh(existing: FindingRow[], conflicts: DetectedConflict[]): FindingsPlan {
  const byKey = new Map(existing.map((r) => [key(r.ruleId, r.personId), r]));
  const seen = new Set<string>();
  const plan: FindingsPlan = { inserts: [], refresh: [], reopens: [], closes: [] };
  for (const c of conflicts) {
    const k = key(c.ruleId, c.personId);
    if (seen.has(k)) continue; // family conflicts can repeat a rule id per person
    seen.add(k);
    const row = byKey.get(k);
    if (!row) plan.inserts.push(c);
    else if (row.status === "closed") plan.reopens.push({ row, conflict: c });
    else plan.refresh.push({ row, conflict: c });
  }
  for (const row of existing) {
    if (row.status === "open" && !seen.has(key(row.ruleId, row.personId))) plan.closes.push(row);
  }
  return plan;
}

export type FindingsRefreshSummary = {
  inserted: number;
  refreshed: number;
  reopened: number;
  closed: number;
  open: number;
};

/**
 * A finding is residual-accepted when the engine says its control is, or
 * when the register holds a current accept_residual decision on this very
 * finding. The engine's flag is control-wide; the register's is per finding.
 */
export function findingAccepted(conflict: DetectedConflict, decisions: ControlDecision[]): boolean {
  return (
    conflict.residualRiskAccepted ||
    latestDecisionFor(decisions, "sod_finding", conflict.id)?.kind === "accept_residual"
  );
}

/** Applies the plan for one tenant inside the caller's transaction. */
export async function refreshSodFindings(
  db: AppDb,
  tenantId: string,
  report: SodDetectionReport,
  now: Date,
  decisions: ControlDecision[] = []
): Promise<FindingsRefreshSummary> {
  const existing = await db.select().from(sodFindings).where(eq(sodFindings.tenantId, tenantId));
  const plan = planFindingsRefresh(existing, report.conflicts);
  const accepted = (c: DetectedConflict) => findingAccepted(c, decisions);

  for (const c of plan.inserts) {
    await db.insert(sodFindings).values({
      id: uuidv7(now.getTime()),
      tenantId,
      ruleId: c.ruleId,
      personId: c.personId,
      entitlementA: c.entitlementA,
      entitlementB: c.entitlementB,
      severity: c.severity,
      score: c.score,
      status: "open",
      dualReleaseMitigated: c.dualReleaseMitigated,
      residualRiskAccepted: accepted(c),
      linkedControlId: c.linkedControlId ?? null,
      conflict: c,
      rulebookVersion: CONTROL_RULEBOOK_VERSION,
      firstSeenAt: now,
      lastSeenAt: now,
      closedAt: null,
      reopenedCount: 0,
    });
  }
  for (const { row, conflict: c } of plan.refresh) {
    await db
      .update(sodFindings)
      .set({
        score: c.score,
        severity: c.severity,
        dualReleaseMitigated: c.dualReleaseMitigated,
        residualRiskAccepted: accepted(c),
        linkedControlId: c.linkedControlId ?? null,
        conflict: c,
        rulebookVersion: CONTROL_RULEBOOK_VERSION,
        lastSeenAt: now,
      })
      .where(and(eq(sodFindings.id, row.id), eq(sodFindings.tenantId, tenantId)));
  }
  for (const { row, conflict: c } of plan.reopens) {
    await db
      .update(sodFindings)
      .set({
        status: "open",
        closedAt: null,
        reopenedCount: row.reopenedCount + 1,
        score: c.score,
        severity: c.severity,
        dualReleaseMitigated: c.dualReleaseMitigated,
        residualRiskAccepted: accepted(c),
        linkedControlId: c.linkedControlId ?? null,
        conflict: c,
        rulebookVersion: CONTROL_RULEBOOK_VERSION,
        lastSeenAt: now,
      })
      .where(and(eq(sodFindings.id, row.id), eq(sodFindings.tenantId, tenantId)));
  }
  for (const row of plan.closes) {
    await db
      .update(sodFindings)
      .set({ status: "closed", closedAt: now })
      .where(and(eq(sodFindings.id, row.id), eq(sodFindings.tenantId, tenantId)));
  }

  return {
    inserted: plan.inserts.length,
    refreshed: plan.refresh.length,
    reopened: plan.reopens.length,
    closed: plan.closes.length,
    open: plan.inserts.length + plan.refresh.length + plan.reopens.length,
  };
}

export async function listFindings(db: AppDb, tenantId: string): Promise<FindingRow[]> {
  return db.select().from(sodFindings).where(eq(sodFindings.tenantId, tenantId)).orderBy(sodFindings.firstSeenAt);
}
