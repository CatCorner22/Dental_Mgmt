import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { getAuthPorts } from "@/lib/auth/resolveStore";
import { getSessionIdFromAuth } from "@/lib/auth/sessionId";
import { getStatement, patientIdsFromStatement } from "@/lib/statements/service";

export const GET = withGuard(
  async (_req, ctx) => {
    const params = await ctx.params;
    const id = typeof params.id === "string" ? params.id : params.id?.[0];
    if (!id) return Response.json({ error: "Missing statement id." }, { status: 400 });

    const statement = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => getStatement(db, ctx.access.user.tenantId, id)
    );
    if (!statement) {
      return Response.json({ error: "Statement not found." }, { status: 404 });
    }

    const ports = await getAuthPorts(getSessionIdFromAuth);
    const patientIds = patientIdsFromStatement(statement);
    if (ports && patientIds.length > 0) {
      await ports.logPhiAccess({
        tenantId: ctx.access.user.tenantId,
        userId: ctx.access.user.id,
        purpose: "payment",
        recordKind: "patient",
        recordIds: patientIds,
        at: new Date(),
      });
    }

    return Response.json({ statement });
  },
  { minRank: "user" }
);
