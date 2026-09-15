import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listReconciliationRuns } from "@/lib/reconciliation/queries";

export const GET = withGuard(
  async (_req, ctx) => {
    const runs = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => listReconciliationRuns(db, ctx.access.user.tenantId)
    );
    return Response.json({ runs });
  },
  { entitlements: ["bank_reconcile"] }
);
