import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { getAuthStore } from "@/lib/auth/resolveStore";
import {
  everybodySignedOutSentence,
  revokeAllSessionsForTenant,
  revokeReasonProblem,
} from "@/lib/auth/revokeAllSessions";
import { listRevokeAllHistory } from "@/lib/auth/revokeHistory";

/**
 * The practice's recent sign-out-everybody acts (Increment 1.102).
 *
 * Administrator rank, the rank the act itself needs. The reason somebody
 * typed names the incident the practice was in the middle of, so it is read
 * by the seats that may cause one, not by everybody who can open the screen
 * it sits on.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const items = await withTenantTransaction(user.tenantId, user.id, (db) =>
      listRevokeAllHistory(db, user.tenantId)
    );
    return Response.json({ items });
  },
  { minRank: "admin" }
);

type Body = { reason?: unknown };

/**
 * End every live sign-in in the practice (Increment 1.90 gave it a screen).
 *
 * Administrator rank. This is the blunt act beside Increment 1.88's
 * proportionate one: it signs out the person pressing it along with everybody
 * else, which is why the screen says so before the press and why the reason is
 * typed rather than assumed.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const problem = revokeReasonProblem(reason);
    if (problem !== null) {
      return Response.json({ error: problem, code: "malformed" }, { status: 400 });
    }
    const store = await getAuthStore();
    if (!store) {
      return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
    }
    const now = new Date();
    const result = await revokeAllSessionsForTenant(store, {
      tenantId: ctx.access.user.tenantId,
      actorUserId: ctx.access.user.id,
      reason,
      at: now,
    });
    return Response.json({
      ok: true,
      revoked: result.revoked,
      sentence: everybodySignedOutSentence(result.revoked),
    });
  },
  { minRank: "admin" }
);
