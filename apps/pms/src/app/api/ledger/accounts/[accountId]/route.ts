import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { getAuthPorts } from "@/lib/auth/resolveStore";
import { getSessionIdFromAuth } from "@/lib/auth/sessionId";
import { getLedgerAccountDetail } from "@/lib/ledger/queries";

export const GET = withGuard(
  async (_req, ctx) => {
    const rawId = (await ctx.params).accountId;
    const accountId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!accountId) {
      return Response.json({ error: "accountId is required." }, { status: 400 });
    }

    const detail = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => getLedgerAccountDetail(db, ctx.access.user.tenantId, accountId)
    );

    if (!detail) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }

    const ports = await getAuthPorts(getSessionIdFromAuth);
    if (ports && detail.patients.length > 0) {
      await ports.logPhiAccess({
        tenantId: ctx.access.user.tenantId,
        userId: ctx.access.user.id,
        purpose: "payment",
        recordKind: "patient",
        recordIds: detail.patients.map((p) => p.patientId),
        at: new Date(),
      });
    }

    return Response.json(detail);
  },
  { minRank: "user" }
);
