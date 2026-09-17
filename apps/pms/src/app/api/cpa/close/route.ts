import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { closeMonth } from "@/lib/cpa/close";

type Body = { month?: string };

/**
 * Closes a month (Increment 1.36): one append-only row freezing the package
 * hash, and one chain event. Administrator rank, and irreversible: a closed
 * month is never re-opened, so the page confirms before calling this.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, (db) =>
      closeMonth(db, { tenantId: user.tenantId, actor: { id: user.id, name: user.displayName }, month: String(body.month ?? "") })
    );
    if (!result.ok) {
      return Response.json({ error: "The month was not closed.", errors: result.errors }, { status: result.status });
    }
    return Response.json(result.close, { status: 201 });
  },
  { minRank: "admin" }
);
