import { CPA_SEAT_ENTITLEMENT, isCpaSeat } from "@/lib/auth/seats";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { askAboutLine, listLines, listThreads, replyToThread, type ThreadSeat } from "@/lib/cpa/questions";
import { isRole } from "@/lib/auth/roles";

/**
 * The threads the accountant and the practice hold about one month's package
 * (Increment 1.50). Whoever may read the package may read and open them, which
 * is the manager's rank or the accountant's seat.
 *
 * The seat a message is recorded under is read from the signed-in user, never
 * from the request body: which side spoke is what decides whether the practice
 * still owes an answer, so it is not the caller's to assert.
 */
function seatOf(user: { role: string; entitlements: string[] }): ThreadSeat {
  const role = isRole(user.role) ? user.role : undefined;
  return role && isCpaSeat({ role, entitlements: user.entitlements }) ? "accountant" : "practice";
}

export const GET = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const { items, lines } = await withTenantTransaction(user.tenantId, user.id, async (db) => ({
      items: await listThreads(db, user.tenantId, month),
      lines: await listLines(db, user.tenantId, month),
    }));
    return Response.json({ month, items, lines, seat: seatOf(user) });
  },
  { minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }
);

export const POST = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const body = (await req.json().catch(() => null)) as
      | { action?: string; month?: string; subjectKey?: string; threadId?: string; body?: string }
      | null;
    if (!body?.action) return Response.json({ error: "An action is required." }, { status: 400 });

    const actor = { id: user.id, name: user.displayName };
    const seat = seatOf(user);
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) => {
      if (body.action === "ask") {
        return askAboutLine(db, {
          tenantId: user.tenantId,
          actor,
          seat,
          month: body.month ?? "",
          subjectKey: body.subjectKey ?? "",
          body: body.body ?? "",
        });
      }
      if (body.action === "reply") {
        return replyToThread(db, { tenantId: user.tenantId, actor, seat, threadId: body.threadId ?? "", body: body.body ?? "" });
      }
      return null;
    });

    if (!result) return Response.json({ error: "The action must be ask or reply." }, { status: 400 });
    if (!result.ok) return Response.json({ error: result.code, verb: result.verb, why: result.why }, { status: result.status });
    return Response.json({ ok: true, thread: result.thread });
  },
  { minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }
);
