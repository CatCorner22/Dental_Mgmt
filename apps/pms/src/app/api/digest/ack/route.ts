import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { acknowledgeDigest } from "@/lib/digest/digest";

type Body = { ending?: string; summaryHash?: string };

/**
 * Stamps a week's digest as read: one append-only row binding the hash of
 * the digest the owner saw, and one chain event. Administrator rank.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      acknowledgeDigest(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        ending: String(body.ending ?? ""),
        summaryHash: String(body.summaryHash ?? ""),
      })
    );
    if (!result.ok) {
      return Response.json({ error: "The digest was not acknowledged.", errors: result.errors }, { status: result.status });
    }
    return Response.json(result.ack, { status: 201 });
  },
  { minRank: "admin" }
);
