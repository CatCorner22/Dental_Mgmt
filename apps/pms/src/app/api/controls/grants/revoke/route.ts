import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { revokeEntitlement } from "@/lib/controls/grants";

type Body = { targetUserId?: string; entitlement?: string; reason?: string };

/** Ends every live grant for the pair; rows are closed, never deleted. */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.targetUserId || !body.entitlement) {
      return Response.json({ error: "targetUserId and entitlement are required." }, { status: 400 });
    }
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      revokeEntitlement(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        targetUserId: body.targetUserId!,
        entitlement: body.entitlement!,
        reason: body.reason,
      })
    );
    if (!result.ok) {
      return Response.json(
        { error: result.why, code: result.code, nextSteps: result.nextSteps },
        { status: result.status }
      );
    }
    return Response.json(result);
  },
  { minRank: "admin" }
);
