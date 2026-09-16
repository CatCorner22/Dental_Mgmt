import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { grantEntitlement } from "@/lib/controls/grants";

type Body = {
  targetUserId?: string;
  entitlement?: string;
  reason?: string;
  decision?: { kind?: string; note?: string; reviewBy?: string };
};

/**
 * Grants one entitlement. A grant that would create an unmitigated critical
 * SoD conflict is refused (403) unless the body carries a control decision
 * with a review date; the refusal names the conflicts and the next steps.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.targetUserId || !body.entitlement) {
      return Response.json({ error: "targetUserId and entitlement are required." }, { status: 400 });
    }
    const decision =
      body.decision && typeof body.decision === "object"
        ? {
            kind: String(body.decision.kind ?? ""),
            note: String(body.decision.note ?? ""),
            reviewBy: body.decision.reviewBy ? String(body.decision.reviewBy) : undefined,
          }
        : undefined;

    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      grantEntitlement(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        targetUserId: body.targetUserId!,
        entitlement: body.entitlement!,
        reason: body.reason,
        decision,
      })
    );

    if (!result.ok) {
      return Response.json(
        {
          error: result.why,
          code: result.code,
          nextSteps: result.nextSteps,
          conflicts: result.conflicts ?? [],
        },
        { status: result.status }
      );
    }
    return Response.json(result, { status: 201 });
  },
  { minRank: "admin" }
);
