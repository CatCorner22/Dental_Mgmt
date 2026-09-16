import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { evaluateChannelRelease } from "@/lib/controls/release";

type Body = {
  channel?: string;
  amountUsd?: number;
  initiatorPersonId?: string;
  secondPersonId?: string;
  payee?: string;
  memo?: string;
};

/**
 * Evaluates a release on any dual-release channel for a caller outside the
 * ledger (deposit bag, new vendor, payroll file) and records the result.
 * The response names the channel's enforcement class so an external
 * channel is never read as enforced.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      evaluateChannelRelease(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        channel: String(body.channel ?? ""),
        amountUsd: Number(body.amountUsd),
        initiatorPersonId: body.initiatorPersonId,
        secondPersonId: body.secondPersonId,
        payee: body.payee,
        memo: body.memo,
      })
    );
    if (!result.ok) {
      return Response.json({ error: result.why, code: result.code }, { status: result.status });
    }
    return Response.json(result);
  },
  { minRank: "user" }
);
