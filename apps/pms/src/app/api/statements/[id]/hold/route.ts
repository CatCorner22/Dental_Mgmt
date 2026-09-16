import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { holdStatement } from "@/lib/statements/service";

type HoldBody = {
  reason?: string;
};

export const POST = withGuard(
  async (req, ctx) => {
    const params = await ctx.params;
    const id = typeof params.id === "string" ? params.id : params.id?.[0];
    if (!id) return Response.json({ error: "Missing statement id." }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as HoldBody;
    const result = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) =>
        holdStatement(db, {
          tenantId: ctx.access.user.tenantId,
          actorUserId: ctx.access.user.id,
          actorName: ctx.access.user.displayName,
          statementId: id,
          reason: body.reason ?? "",
        })
    );

    if ("error" in result) {
      if (result.error === "reason_required") {
        return Response.json({ error: "hold_reason is required." }, { status: 400 });
      }
      const status = result.error === "not_found" ? 404 : 409;
      return Response.json({ error: result.error }, { status });
    }

    return Response.json({ statement: result });
  },
  { entitlements: ["post_payments"] }
);
