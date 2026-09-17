import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { buildOwnerBoard } from "@/lib/home/board";

/** The owner's home board, computed from live rows on every read. Manager rank and above. */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const board = await withTenantTransaction(user.tenantId, user.id, (db) => buildOwnerBoard(db, user.tenantId, user.id));
    return Response.json(board);
  },
  { minRank: "manager" }
);
