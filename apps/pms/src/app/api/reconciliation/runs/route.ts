import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { matchingSummary, measureMatchingLive } from "@/lib/controls/matchingMeasure";
import { measureReconciliation, measurementSummary } from "@/lib/controls/reconciliationMeasure";
import { listReconciliationRuns } from "@/lib/reconciliation/queries";

/**
 * The runs, plus the two measurements the reconciliation screen shows over
 * them: the independence grade and the detection lag / 48-hour match rate,
 * computed from live rows on every read so the screen never shows a stale
 * grade beside a fresh run.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const tenantId = ctx.access.user.tenantId;
    const body = await withTenantTransaction(tenantId, ctx.access.user.id, async (db) => {
      const now = new Date();
      const runs = await listReconciliationRuns(db, tenantId);
      const reconciliation = measurementSummary(await measureReconciliation(db, tenantId, now));
      const matching = matchingSummary(await measureMatchingLive(db, tenantId, now));
      return { runs, measurements: { reconciliation, matching } };
    });
    return Response.json(body);
  },
  { entitlements: ["bank_reconcile"] }
);
