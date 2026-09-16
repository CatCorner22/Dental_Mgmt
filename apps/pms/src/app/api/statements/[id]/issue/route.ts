import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { issueStatement } from "@/lib/statements/service";

export const POST = withGuard(
  async (_req, ctx) => {
    const params = await ctx.params;
    const id = typeof params.id === "string" ? params.id : params.id?.[0];
    if (!id) return Response.json({ error: "Missing statement id." }, { status: 400 });

    const result = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) =>
        issueStatement(db, {
          tenantId: ctx.access.user.tenantId,
          actorUserId: ctx.access.user.id,
          actorName: ctx.access.user.displayName,
          statementId: id,
        })
    );

    if ("error" in result) {
      const status = result.error === "not_found" ? 404 : 409;
      const message =
        result.error === "held"
          ? "Statement is held and cannot be issued."
          : result.error === "already_issued"
            ? "Statement is already issued."
            : result.error === "void"
              ? "Statement is void."
              : "Statement not found.";
      return Response.json({ error: message, code: result.error }, { status });
    }

    return Response.json({ statement: result });
  },
  { entitlements: ["post_payments"] }
);
