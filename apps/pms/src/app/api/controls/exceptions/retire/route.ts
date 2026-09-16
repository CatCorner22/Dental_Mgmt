import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { retireException } from "@/lib/controls/exceptions";

type Body = { exceptionId?: string; reason?: string };

/** Retires an exception in a new policy version: disabled and ended today. */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.exceptionId) return Response.json({ error: "exceptionId is required." }, { status: 400 });
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      retireException(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        exceptionId: body.exceptionId!,
        reason: body.reason,
      })
    );
    if (!result.ok) {
      return Response.json({ error: "The exception was not retired.", code: result.code, errors: result.errors }, {
        status: result.status,
      });
    }
    return Response.json(result);
  },
  { minRank: "admin" }
);
