import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { FINDING_KIND_LABEL, listControlFindings } from "@/lib/controls/detectors";

/**
 * Detector findings as recorded: open first, then closed. Rows are written
 * only by the detectors (on every frozen snapshot, nightly and manual); this
 * route reads them. Manager rank and above.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const rows = await withTenantTransaction(user.tenantId, user.id, (db) => listControlFindings(db, user.tenantId));
    const items = rows.map((r) => ({
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
    }));
    const open = items.filter((i) => i.status === "open");
    return Response.json({
      items,
      summary: {
        open: open.length,
        closed: items.length - open.length,
        high: open.filter((i) => i.severity === "high").length,
        medium: open.filter((i) => i.severity === "medium").length,
        low: open.filter((i) => i.severity === "low").length,
      },
    });
  },
  { minRank: "manager" }
);
