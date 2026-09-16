import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { loadActivePolicy } from "@/lib/controls/policy";

export const GET = withGuard(
  async (_req, ctx) => {
    const active = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      async (db) => loadActivePolicy(db, ctx.access.user.tenantId)
    );
    if (!active) {
      return Response.json({ error: "No control policy is configured for this practice." }, { status: 404 });
    }
    return Response.json({
      version: active.version,
      rulebookVersion: active.rulebookVersion,
      policy: active.policy,
    });
  },
  { minRank: "user" }
);
