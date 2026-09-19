import { eq } from "drizzle-orm";
import { tenants } from "@pms/db";
import { isRole } from "@/lib/auth/roles";
import { CPA_SEAT_ENTITLEMENT, isCpaSeat } from "@/lib/auth/seats";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { collectOutstanding, type NoticeSeat } from "@/lib/notices/outstanding";
import { sendNotices } from "@/lib/notices/send";
import { transportFromEnv } from "@/lib/notices/transport";

/**
 * Sends this person their own notices now, and records what happened
 * (Increment 1.59).
 *
 * A person sends to themselves and to nobody else, for the reason Increment
 * 1.58 gave the address: this is the act whose whole risk is being done on
 * somebody else's behalf. The route takes no recipient, so there is none to
 * supply.
 *
 * On demand rather than on a schedule, deliberately. A schedule needs a
 * decision about what "since you last read" means when nothing records a read,
 * and it needs a cron the practice can trust; asking for it is both the honest
 * first half and the act that answers the question somebody actually has before
 * relying on any of this — does delivery work for me?
 *
 * Every outcome answers 200, including a failure. The attempt happened, the
 * record is written, and the answer says how it went; an HTTP error would make
 * a failed delivery look like a failed request, which is the confusion the
 * whole increment exists to prevent.
 */

function seatOf(user: { role: string; entitlements: string[] }): NoticeSeat {
  const role = isRole(user.role) ? user.role : undefined;
  return role && isCpaSeat({ role, entitlements: user.entitlements }) ? "accountant" : "owner";
}

export const POST = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const seat = seatOf(user);
    const appUrl = new URL(req.url).origin;
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) => {
      const practiceName =
        (await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1))[0]?.name ?? "This practice";
      return sendNotices(db, {
        tenantId: user.tenantId,
        recipientId: user.id,
        recipientName: user.displayName,
        seat,
        practiceName,
        appUrl,
        notices: await collectOutstanding(db, user.tenantId),
        transport: transportFromEnv(),
      });
    });
    return Response.json(result);
  },
  { minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }
);
