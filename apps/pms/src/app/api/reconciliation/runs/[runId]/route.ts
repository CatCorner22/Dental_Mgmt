import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { evaluateRunClearance } from "@/lib/reconciliation/clear";
import { getReconciliationRun } from "@/lib/reconciliation/queries";

export const GET = withGuard(
  async (_req, ctx) => {
    const params = await ctx.params;
    const runId = typeof params.runId === "string" ? params.runId : params.runId?.[0];
    if (!runId) return Response.json({ error: "Missing reconciliation run id." }, { status: 400 });
    const run = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      async (db) => {
        const detail = await getReconciliationRun(db, ctx.access.user.tenantId, runId);
        if (!detail) return null;
        const clearance = await evaluateRunClearance(db, {
          tenantId: ctx.access.user.tenantId,
          run: detail,
          actor: {
            id: ctx.access.user.id,
            role: ctx.access.user.role,
            entitlements: ctx.access.user.entitlements,
          },
        });
        return { ...detail, clearance };
      }
    );
    if (!run) {
      return Response.json({ error: "Reconciliation run not found." }, { status: 404 });
    }
    return Response.json({ run });
  },
  { entitlements: ["bank_reconcile"] }
);
