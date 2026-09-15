import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listBankAccounts } from "@/lib/reconciliation/queries";

export const GET = withGuard(
  async (_req, ctx) => {
    const accounts = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => listBankAccounts(db, ctx.access.user.tenantId)
    );
    return Response.json({ accounts });
  },
  { entitlements: ["bank_reconcile"] }
);
