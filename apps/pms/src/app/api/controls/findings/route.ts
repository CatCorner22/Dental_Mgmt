import { DECISION_KIND_LABEL } from "@pms/controls-engine";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listDecisions } from "@/lib/controls/decisions";
import { FINDING_KIND_LABEL, governingFindingDecision, listControlFindings, summarizeFindings } from "@/lib/controls/detectors";

/**
 * Detector findings as recorded: open first, then closed, each with the
 * active decision that governs it, if any. Rows are written only by the
 * detectors (on every frozen snapshot, nightly and manual); decisions are
 * recorded at POST /api/controls/decisions with subjectKind
 * "detector_finding". This route reads both. Manager rank and above.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const asOf = new Date().toISOString().slice(0, 10);
    const { rows, decisions } = await withTenantTransaction(user.tenantId, user.id, async (db) => ({
      rows: await listControlFindings(db, user.tenantId),
      decisions: await listDecisions(db, user.tenantId),
    }));
    const items = rows.map((r) => {
      const d = governingFindingDecision(r.id, decisions);
      return {
        id: r.id,
        kind: r.kind,
        kindLabel: FINDING_KIND_LABEL[r.kind] ?? r.kind.replace(/_/g, " "),
        subjectKind: r.subjectKind,
        subjectId: r.subjectId,
        severity: r.severity,
        status: r.status,
        detail: r.detail as Record<string, unknown>,
        detectorVersion: r.detectorVersion,
        firstSeenAt: r.firstSeenAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        closedAt: r.closedAt?.toISOString() ?? null,
        closedReason: r.closedReason,
        reopenedCount: r.reopenedCount,
        decision: d
          ? {
              id: d.id,
              kind: d.kind,
              kindLabel: DECISION_KIND_LABEL[d.kind],
              note: d.note,
              reviewBy: d.reviewBy ?? null,
              overdue: d.reviewBy != null && d.reviewBy < asOf,
              decidedAt: d.decidedAt,
              decidedByName: d.decidedByName,
            }
          : null,
      };
    });
    return Response.json({ asOf, items, summary: summarizeFindings(rows, decisions) });
  },
  { minRank: "manager" }
);
