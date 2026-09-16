import { decisionCoverage } from "@pms/controls-engine";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listFindings } from "@/lib/controls/findings";
import { loadControlsContext } from "@/lib/controls/practiceState";

/**
 * Segregation of duties from real grants: the live report, the stored
 * findings with their history, and which conflicts still lack a decision.
 * Scores describe duty combinations, never people.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const out = await withTenantTransaction(user.tenantId, user.id, async (db) => {
      const context = await loadControlsContext(db, user.tenantId);
      const findings = await listFindings(db, user.tenantId);
      const coverage = decisionCoverage(context.built.sod.conflicts, context.decisions, context.asOf);
      return {
        asOf: context.asOf,
        rulebookVersion: context.built.sod.conflicts[0]?.ruleId ? undefined : undefined,
        policyConfigured: context.active != null,
        summary: context.built.sod.summary,
        recommendations: context.built.sod.recommendations,
        assignments: context.built.assignments,
        conflicts: context.built.sod.conflicts,
        matrix: context.built.sod.matrix,
        entitlementOrder: context.built.sod.entitlementOrder,
        unknownEntitlements: context.built.unknownEntitlements,
        mitigatedRuleIds: context.built.mitigatedRuleIds,
        decisions: {
          coveragePct: coverage.coveragePct,
          openConflictIds: coverage.open.map((c) => c.id),
          overdueConflictIds: coverage.overdue.map((d) => d.conflict.id),
        },
        findings: findings.map((f) => ({
          id: f.id,
          ruleId: f.ruleId,
          personId: f.personId,
          severity: f.severity,
          score: f.score,
          status: f.status,
          dualReleaseMitigated: f.dualReleaseMitigated,
          residualRiskAccepted: f.residualRiskAccepted,
          firstSeenAt: f.firstSeenAt.toISOString(),
          lastSeenAt: f.lastSeenAt.toISOString(),
          closedAt: f.closedAt?.toISOString() ?? null,
          reopenedCount: f.reopenedCount,
        })),
      };
    });
    return Response.json(out);
  },
  { minRank: "manager" }
);
