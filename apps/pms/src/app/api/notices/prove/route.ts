import { eq } from "drizzle-orm";
import { tenants } from "@pms/db";
import { isRole } from "@/lib/auth/roles";
import { CPA_SEAT_ENTITLEMENT, isCpaSeat } from "@/lib/auth/seats";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import type { NoticeSeat } from "@/lib/notices/outstanding";
import { proveAddress, sendProofCode } from "@/lib/notices/proof";
import { transportFromEnv } from "@/lib/notices/transport";

/**
 * Asking for a code, and bringing one back (Increment 1.61).
 *
 * One route for both halves, because they are one act with a gap in the middle
 * and a person doing the second is always a person who just did the first. A
 * body carrying a code proves; a body carrying none asks.
 *
 * A person proves their own address and nobody else's, as they set their own:
 * the route takes no user id, and the database refuses a row naming anybody but
 * the caller, so neither a mistake here nor a later caller can prove somebody
 * else's mailbox for them.
 *
 * Asking for a code answers 200 even where the code could not be delivered,
 * for Increment 1.59's reason: the attempt happened and is recorded, and an
 * HTTP error would make a failed delivery look like a failed request. The two
 * states a person must tell apart are "it went" and "it did not", and the
 * answer says which in words.
 */

function seatOf(user: { role: string; entitlements: string[] }): NoticeSeat {
  const role = isRole(user.role) ? user.role : undefined;
  return role && isCpaSeat({ role, entitlements: user.entitlements }) ? "accountant" : "owner";
}

export const POST = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const raw = body.code;
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return Response.json(
        { error: "malformed", verb: "prove this address", why: "A code is text." },
        { status: 400 }
      );
    }
    const code = typeof raw === "string" && raw.trim() !== "" ? raw : null;
    const appUrl = new URL(req.url).origin;

    const result = await withTenantTransaction(user.tenantId, user.id, async (db) => {
      if (code !== null) return proveAddress(db, user.tenantId, user.id, user.displayName, code);
      const practiceName =
        (await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1))[0]?.name ?? "This practice";
      return sendProofCode(db, {
        tenantId: user.tenantId,
        userId: user.id,
        userName: user.displayName,
        seat: seatOf(user),
        practiceName,
        appUrl,
        transport: transportFromEnv(),
      });
    });

    if (!result.ok) {
      return Response.json({ error: result.code, verb: result.verb, why: result.why }, { status: result.status });
    }
    return Response.json(result);
  },
  { minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }
);
