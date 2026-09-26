import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { administrators, changeRank } from "@/lib/controls/ranks";
import { setPersonActive } from "@/lib/controls/roster";
import { loadStaff } from "@/lib/controls/staff";
import { precogRole } from "@/lib/controls/people";
import { isRole, ROLE_RANK } from "@/lib/auth/roles";

type Body = {
  targetUserId?: string;
  /** A rank change names this. */
  rank?: string;
  /** Standing somebody down or bringing them back names this instead. */
  active?: boolean;
  reason?: string;
};

/**
 * The practice's roster and the rank each person holds (Increment 1.78).
 *
 * Manager rank reads it and administrator rank changes it, the split Practice
 * Risk holds everywhere else. The Precog label is returned beside the rank
 * because that label, not the rank, is what the dual-release rules name — so
 * a reader can see that promoting somebody to administrator is what makes
 * them "Owner / Dentist" to those rules.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const staff = await withTenantTransaction(user.tenantId, user.id, (db) => loadStaff(db, user.tenantId));
    const admins = administrators(staff.rows.map((r) => ({ id: r.id, role: r.role, active: r.active })));
    return Response.json({
      /**
       * Everybody, not only the people still on the practice: a roster that
       * hid somebody stood down would offer no way to bring them back
       * (Increment 1.79).
       */
      people: staff.rows
        .map((r) => ({
          userId: r.id,
          displayName: r.displayName,
          rank: r.role,
          controlRole: precogRole(r),
          entitlements: r.entitlements,
          active: r.active,
          /** This viewer, whom both acts refuse against themselves. */
          mine: r.id === user.id,
        }))
        .sort((a, b) => (ROLE_RANK[isRole(b.rank) ? b.rank : "readonly"] - ROLE_RANK[isRole(a.rank) ? a.rank : "readonly"]) || a.displayName.localeCompare(b.displayName)),
      administrators: admins.length,
      ranks: Object.keys(ROLE_RANK),
      asOf: new Date().toISOString(),
    });
  },
  { minRank: "manager" }
);

/**
 * Changes one person's rank, and answers with the release channels the change
 * opened and closed for that person.
 *
 * No control decision is asked for, deliberately. A rank grants no
 * entitlement, so the segregation-of-duties rulebook — which scores duty
 * combinations from live grants and infers nothing from a label — has nothing
 * to refuse; a gate modelled on `api/controls/grants` would refuse nothing
 * ever. What a rank moves is signing power, and that is reported rather than
 * gated. See `lib/controls/ranks.ts` for why.
 *
 * The same POST stands somebody down or brings them back when the body names
 * `active` instead of `rank` (Increment 1.79). Deactivating ends every live
 * grant and revokes the sessions; reactivating restores the account and not
 * the powers. See `lib/controls/roster.ts` for why.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const standing = typeof body.active === "boolean";
    if (!body.targetUserId || (!body.rank && !standing)) {
      return Response.json({ error: "targetUserId and either rank or active are required." }, { status: 400 });
    }
    const user = ctx.access.user;
    const actor = { id: user.id, name: user.displayName };
    /**
     * Two acts on one roster, behind one route (Increment 1.79). They read
     * the same list and refuse on the same practice-level rule, and a practice
     * that had to find them on two screens would have to decide which list was
     * the roster.
     */
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      standing
        ? setPersonActive(db, {
            tenantId: user.tenantId,
            actor,
            targetUserId: body.targetUserId!,
            active: body.active!,
            reason: body.reason,
          })
        : changeRank(db, {
            tenantId: user.tenantId,
            actor,
            targetUserId: body.targetUserId!,
            rank: body.rank!,
            reason: body.reason,
          })
    );

    if (!result.ok) {
      return Response.json(
        { error: result.why, code: result.code, nextSteps: result.nextSteps },
        { status: result.status }
      );
    }
    return Response.json(result, { status: 200 });
  },
  { minRank: "admin" }
);
