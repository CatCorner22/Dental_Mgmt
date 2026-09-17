import { and, eq, isNull } from "drizzle-orm";
import { controlDecisions, controlFindings, deposits, ledgerEntries, reconciliationRuns, userEntitlements } from "@pms/db";
import type { AppDb } from "../db/client";

/**
 * Who a detector finding is about, for the self-licensing rule (Increment
 * 1.26). A finding's sentence never names a person, but its subject row
 * does carry hands: the one holder of a sole-held duty, the person who
 * cleared a degraded run, who made the overdue decision, who posted the
 * ledger entry, who prepared the deposit. Those people may remediate,
 * monitor, or insure the finding like anyone else; they may not accept the
 * residual or name a compensating control on their own work. A bank line
 * belongs to the bank, so it implicates nobody.
 *
 * Lives apart from detectors.ts because decisions.ts needs it and
 * detectors.ts already imports decisions.ts.
 */
export type FindingSubject = Pick<typeof controlFindings.$inferSelect, "id" | "kind" | "subjectKind" | "subjectId" | "status">;

export async function loadFindingSubject(db: AppDb, tenantId: string, findingId: string): Promise<FindingSubject | null> {
  const rows = await db
    .select({
      id: controlFindings.id,
      kind: controlFindings.kind,
      subjectKind: controlFindings.subjectKind,
      subjectId: controlFindings.subjectId,
      status: controlFindings.status,
    })
    .from(controlFindings)
    .where(and(eq(controlFindings.tenantId, tenantId), eq(controlFindings.id, findingId)));
  return rows[0] ?? null;
}

/** The user ids the finding's subject row implicates; empty when it implicates nobody. */
export async function implicatedUserIds(db: AppDb, tenantId: string, finding: FindingSubject): Promise<string[]> {
  switch (finding.subjectKind) {
    case "entitlement": {
      const rows = await db
        .select({ userId: userEntitlements.userId })
        .from(userEntitlements)
        .where(and(eq(userEntitlements.tenantId, tenantId), eq(userEntitlements.entitlement, finding.subjectId), isNull(userEntitlements.effectiveTo)));
      return [...new Set(rows.map((r) => r.userId))];
    }
    case "reconciliation_run": {
      const rows = await db
        .select({ clearedById: reconciliationRuns.clearedById })
        .from(reconciliationRuns)
        .where(and(eq(reconciliationRuns.tenantId, tenantId), eq(reconciliationRuns.id, finding.subjectId)));
      return rows.map((r) => r.clearedById).filter((id): id is string => Boolean(id));
    }
    case "control_decision": {
      const rows = await db
        .select({ decidedById: controlDecisions.decidedById })
        .from(controlDecisions)
        .where(and(eq(controlDecisions.tenantId, tenantId), eq(controlDecisions.id, finding.subjectId)));
      return rows.map((r) => r.decidedById);
    }
    case "ledger_entry": {
      const rows = await db
        .select({ createdById: ledgerEntries.createdById })
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.tenantId, tenantId), eq(ledgerEntries.id, finding.subjectId)));
      return rows.map((r) => r.createdById);
    }
    case "deposit": {
      const rows = await db
        .select({ preparedById: deposits.preparedById })
        .from(deposits)
        .where(and(eq(deposits.tenantId, tenantId), eq(deposits.id, finding.subjectId)));
      return rows.map((r) => r.preparedById);
    }
    default:
      return [];
  }
}
