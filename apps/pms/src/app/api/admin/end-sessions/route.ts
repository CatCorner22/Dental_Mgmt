import { withGuard } from "@/lib/auth/withGuard";
import { getAuthStore } from "@/lib/auth/resolveStore";
import { endSessionsForPerson, endedSentence } from "@/lib/auth/endSessions";

type Body = { userId?: unknown };

/**
 * End one named person's sessions (Increment 1.88).
 *
 * Administrator rank, as `api/admin/revoke-all-sessions` is. The act is
 * disruptive rather than destructive: the person signs in again with the
 * password and a code they already hold, and nothing they did is undone.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const targetUserId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (targetUserId === "") {
      return Response.json({ error: "Name the person whose sessions to end.", code: "malformed" }, { status: 400 });
    }
    const store = await getAuthStore();
    if (!store) {
      return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
    }
    const user = ctx.access.user;
    const result = await endSessionsForPerson(store, {
      tenantId: user.tenantId,
      actor: { id: user.id, name: user.displayName },
      targetUserId,
      at: new Date(),
    });
    if (!result.ok) {
      return Response.json({ error: result.why, code: result.code }, { status: result.status });
    }
    return Response.json({
      ok: true,
      revoked: result.revoked,
      sentence: endedSentence(result.displayName, result.revoked),
    });
  },
  { minRank: "admin" }
);
