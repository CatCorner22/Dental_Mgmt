import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { getReconciliationRun } from "@/lib/reconciliation/queries";

export const GET = withGuard(
  async (_req, ctx) => {
    const params = await ctx.params;
    const runId = typeof params.runId === "string" ? params.runId : params.runId?.[0];
    if (!runId) return Response.json({ error: "Missing reconciliation run id." }, { status: 400 });
    const run = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => getReconciliationRun(db, ctx.access.user.tenantId, runId)
    );
    if (!run) {
      return Response.json({ error: "Reconciliation run not found." }, { status: 404 });
    }
    return Response.json({ run });
  },
  { entitlements: ["bank_reconcile"] }
);
