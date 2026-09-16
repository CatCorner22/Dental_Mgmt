import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { getAuthPorts } from "@/lib/auth/resolveStore";
import { getSessionIdFromAuth } from "@/lib/auth/sessionId";
import {
  createDraftStatement,
  listStatements,
  patientIdsFromStatement,
} from "@/lib/statements/service";

export const GET = withGuard(
  async (req, ctx) => {
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId");
    const rows = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => listStatements(db, ctx.access.user.tenantId, accountId)
    );

    const ports = await getAuthPorts(getSessionIdFromAuth);
    const patientIds = [...new Set(rows.flatMap(patientIdsFromStatement))];
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

    return Response.json({ statements: rows });
  },
  { minRank: "user" }
);

type CreateBody = {
  accountId?: string;
  asOf?: string;
  patientId?: string | null;
};

export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as CreateBody;
    const accountId = body.accountId?.trim();
    if (!accountId) {
      return Response.json({ error: "accountId is required." }, { status: 400 });
    }

    const result = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) =>
        createDraftStatement(db, {
          tenantId: ctx.access.user.tenantId,
          actorUserId: ctx.access.user.id,
          actorName: ctx.access.user.displayName,
          accountId,
          asOf: body.asOf,
          patientId: body.patientId,
        })
    );

    if ("error" in result) {
      const status = result.error === "account_not_found" ? 404 : 400;
      return Response.json({ error: result.error }, { status });
    }

    const ports = await getAuthPorts(getSessionIdFromAuth);
    const patientIds = patientIdsFromStatement(result);
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

    return Response.json({ statement: result }, { status: 201 });
  },
  { entitlements: ["post_payments"] }
);
