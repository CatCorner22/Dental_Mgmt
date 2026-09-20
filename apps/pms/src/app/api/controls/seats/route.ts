import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { inviteAccountant, unclaimedInvitations } from "@/lib/auth/invite";
import { inviteUrl } from "@/lib/auth/inviteLink";

type Body = { username?: string; displayName?: string };

/**
 * Seats this practice has invited and nobody has claimed (Increment 1.71).
 *
 * The link is not among them. It is handed back once, by the POST that minted
 * it, and never again: the rows keep a hash, so a practice that mislaid a link
 * invites again rather than asking this product to repeat a secret it does not
 * hold.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const invitations = await withTenantTransaction(user.tenantId, user.id, (db) =>
      unclaimedInvitations(db, user.tenantId)
    );
    return Response.json({ invitations, asOf: new Date().toISOString() });
  },
  { minRank: "manager" }
);

/**
 * Invites the outside accountant's seat, and hands back the one link that
 * opens it.
 *
 * Owner rank, and only this seat. Increment 1.49 settled that the seat pairs
 * with no duty in the SoD rulebook, so inviting it creates no conflict; a
 * general "invite anybody to any role" would be a grant path around
 * `evaluateGrant`, which is the check every other new duty goes through.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, (db) =>
      inviteAccountant(
        db,
        user.tenantId,
        { id: user.id, name: user.displayName },
        { username: String(body.username ?? ""), displayName: String(body.displayName ?? "") }
      )
    );
    if (!result.ok) {
      return Response.json({ error: result.why, code: result.code }, { status: result.status });
    }
    return Response.json(
      {
        userId: result.seat.userId,
        username: result.seat.username,
        displayName: result.seat.displayName,
        expiresAt: result.seat.expiresAt,
        /**
         * Shown once and stored nowhere. The practice passes it on; this
         * product keeps only a hash of it and cannot repeat it.
         */
        link: inviteUrl(new URL(req.url).origin, { tenantId: user.tenantId, secret: result.seat.secret }),
      },
      { status: 201 }
    );
  },
  { minRank: "admin" }
);
