import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { getAuthPorts } from "@/lib/auth/resolveStore";
import { getSessionIdFromAuth } from "@/lib/auth/sessionId";
import { listLedgerAccounts, listPatientIdsForTenant } from "@/lib/ledger/queries";

export const GET = withGuard(
  async (_req, ctx) => {
    const accounts = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => listLedgerAccounts(db, ctx.access.user.tenantId)
    );

    const ports = await getAuthPorts(getSessionIdFromAuth);
    if (ports) {
      const patientIds = await withTenantTransaction(
        ctx.access.user.tenantId,
        ctx.access.user.id,
        (db) => listPatientIdsForTenant(db, ctx.access.user.tenantId)
      );
      if (patientIds.length > 0) {
        await ports.logPhiAccess({
          tenantId: ctx.access.user.tenantId,
          userId: ctx.access.user.id,
          purpose: "payment",
          recordKind: "patient",
          recordIds: patientIds,
          at: new Date(),
        });
      }
    }

    return Response.json({ accounts });
  },
  { minRank: "user" }
);
