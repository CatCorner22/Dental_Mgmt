import { withGuard } from "@/lib/auth/withGuard";
import { getAuthStore } from "@/lib/auth/resolveStore";
import { revokeAllSessionsForTenant } from "@/lib/auth/revokeAllSessions";

export const POST = withGuard(
  async (_req, ctx) => {
    const store = await getAuthStore();
    if (!store) {
      return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
    }
    const now = new Date();
    const result = await revokeAllSessionsForTenant(store, {
      tenantId: ctx.access.user.tenantId,
      actorUserId: ctx.access.user.id,
      reason: "admin_revoke_all",
      at: now,
    });
    return Response.json({ ok: true, revoked: result.revoked });
  },
  { minRank: "admin" }
);
