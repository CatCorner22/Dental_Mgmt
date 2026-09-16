import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { clearReconciliationRun } from "@/lib/reconciliation/clear";

export const POST = withGuard(
  async (_req, ctx) => {
    const params = await ctx.params;
    const runId = typeof params.runId === "string" ? params.runId : params.runId?.[0];
    if (!runId) return Response.json({ error: "Missing reconciliation run id." }, { status: 400 });

    const result = await withTenantTransaction(ctx.access.user.tenantId, ctx.access.user.id, (db) =>
      clearReconciliationRun(db, {
        tenantId: ctx.access.user.tenantId,
        runId,
        actor: {
          id: ctx.access.user.id,
          role: ctx.access.user.role,
          entitlements: ctx.access.user.entitlements,
          displayName: ctx.access.user.displayName,
        },
      })
    );

    if (result.status === "not_found") {
      return Response.json({ error: "Reconciliation run not found." }, { status: 404 });
    }
    if (result.status === "refused") {
      return Response.json(
        {
          error: result.clearance.verb,
          code: result.clearance.code,
          verb: result.clearance.verb,
          control: "Runtime SoD",
          why: result.clearance.why,
          degradedOwnerClearance: result.clearance.degradedOwnerClearance,
        },
        { status: result.httpStatus }
      );
    }

    return Response.json({ run: result.run, clearance: result.clearance });
  },
  { entitlements: ["bank_reconcile"] }
);
