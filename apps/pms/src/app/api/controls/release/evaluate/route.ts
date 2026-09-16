import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { attestChannelRelease } from "@/lib/controls/release";

type Body = { channel?: string; amountUsd?: number; payee?: string; memo?: string };

/**
 * Attests a release on a channel the ledger does not carry (deposit bag,
 * new vendor, payroll file). The signed-in user is the initiator; the body
 * names no other person. The response says whether a second person is
 * needed and who may second, and the record carries the channel's
 * enforcement class so an attested channel is never read as enforced.
 * Ledger channels (write-off, check, ACH) refuse here.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      attestChannelRelease(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        channel: String(body.channel ?? ""),
        amountUsd: Number(body.amountUsd),
        payee: body.payee,
        memo: body.memo,
      })
    );
    if (!result.ok) {
      return Response.json({ error: result.why, code: result.code }, { status: result.status });
    }
    return Response.json(result);
  },
  { minRank: "lead" }
);
