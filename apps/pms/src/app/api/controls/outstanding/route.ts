import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { collectOutstanding, countBySeat } from "@/lib/notices/outstanding";

/**
 * What each seat owes right now (Increment 1.57), derived from rows on every
 * read and stored nowhere.
 *
 * It is its own route rather than a field on the risk snapshot, because a
 * snapshot may be the frozen one and this is always the practice's position
 * now. Increment 1.36 settled that a figure about a moment and a figure about
 * the present do not belong in one object, and the same holds here.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const notices = await withTenantTransaction(user.tenantId, user.id, (db) => collectOutstanding(db, user.tenantId));
    return Response.json({ notices, counts: countBySeat(notices), computedAt: new Date().toISOString() });
  },
  { minRank: "manager" }
);
