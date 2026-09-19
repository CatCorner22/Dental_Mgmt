import { eq } from "drizzle-orm";
import { tenants } from "@pms/db";
import { isRole } from "@/lib/auth/roles";
import { CPA_SEAT_ENTITLEMENT, isCpaSeat } from "@/lib/auth/seats";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { currentAddress, setAddress } from "@/lib/notices/addresses";
import { renderMessage } from "@/lib/notices/message";
import { collectOutstanding, type NoticeSeat } from "@/lib/notices/outstanding";

/**
 * Where this person's notices would go, and the message that would go there
 * (Increment 1.58). Nothing is sent.
 *
 * One route for both, because they are one question: a person deciding whether
 * to receive these wants to see what receiving them would mean. Showing the
 * message beside the address is also the only way the rule about what a
 * message may contain is visible to the person it protects — they can read,
 * before agreeing to anything, that it names no patient and quotes nobody.
 *
 * The address is always the caller's own. This route accepts no user id, and
 * the database refuses an insert naming anybody else, so neither a mistake
 * here nor a later caller can redirect somebody's notices.
 */

/** Whose debts this viewer would be sent: the accountant's seat, or the practice's. */
function seatOf(user: { role: string; entitlements: string[] }): NoticeSeat {
  const role = isRole(user.role) ? user.role : undefined;
  return role && isCpaSeat({ role, entitlements: user.entitlements }) ? "accountant" : "owner";
}

export const GET = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const seat = seatOf(user);
    const { address, notices, practiceName } = await withTenantTransaction(user.tenantId, user.id, async (db) => ({
      address: await currentAddress(db, user.tenantId, user.id),
      notices: await collectOutstanding(db, user.tenantId),
      practiceName: (await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1))[0]?.name ?? "This practice",
    }));
    // The origin the caller is already looking at, rather than a configured
    // base that can drift from where the product actually runs.
    const appUrl = new URL(req.url).origin;
    return Response.json({
      seat,
      address,
      // Null when this seat owes nothing: there is no message, because a
      // message that arrives whether or not anything happened is not a signal.
      message: renderMessage({ practiceName, seat, notices, appUrl }),
    });
  },
  { minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }
);

export const POST = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const body = (await req.json().catch(() => ({}))) as { address?: unknown };
    // Undefined and the empty string both mean "nowhere", which is a decision
    // the table records rather than an absence it infers.
    const raw = body.address;
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return Response.json({ error: "malformed", verb: "set this address", why: "An address is text, or nothing at all." }, { status: 400 });
    }
    const wanted = raw === undefined || raw === null || raw.trim() === "" ? null : raw;
    const result = await withTenantTransaction(user.tenantId, user.id, (db) =>
      setAddress(db, user.tenantId, user.id, user.displayName, wanted)
    );
    if (!result.ok) return Response.json({ error: result.code, verb: result.verb, why: result.why }, { status: result.status });
    return Response.json({ ok: true, address: result.address });
  },
  { minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }
);
