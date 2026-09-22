import { and, eq, gt, isNull, lte, or, type SQL } from "drizzle-orm";
import { userEntitlements } from "./schema";

/**
 * One definition of a live grant (Increment 1.86).
 *
 * `user_entitlements` rows are never deleted. A grant begins at
 * `effective_from` and ends when `revokeEntitlement` stamps `effective_to`,
 * which is the convention every row in this product follows. A row is
 * therefore live at an instant when it has begun and has not yet ended.
 *
 * That sentence was re-expressed at each site that needed it, and the
 * authorization path expressed it nowhere: `entitlementsFor` in
 * `apps/pms/src/lib/auth/postgresStore.ts` selected every row a user had ever
 * held, so `requireAccess` opened a route on a duty the owner had revoked —
 * on the person's current session and on every one after it, with the screen,
 * the closed SoD finding and the `role.revoked` event all reporting success.
 *
 * The rule is written once here so that the next reader borrows it rather than
 * restating it.
 *
 * **Which clock.** `now` is the caller's, matching `revokeEntitlement`, which
 * stamps `effective_to` from the application clock, and matching the in-memory
 * readers that already take a `now`. Some rows are written with the database's
 * `now()` instead — the seed and several fixtures do — so on a deployment
 * whose database clock runs ahead of its application clock, a grant written
 * that instant can read as not yet begun for the length of the skew. That
 * fails closed, which is the safe direction for an authorization predicate,
 * and it is stated here rather than engineered around: one clock for both ends
 * would mean moving `revokeEntitlement` to the database clock too, which is a
 * larger change than this defect warrants.
 */

/** A grant has begun and has not ended, at `now`. */
export function isLiveGrant(grant: { effectiveFrom: Date; effectiveTo: Date | null }, now: Date): boolean {
  return (
    grant.effectiveFrom.getTime() <= now.getTime() &&
    (grant.effectiveTo === null || grant.effectiveTo.getTime() > now.getTime())
  );
}

/**
 * The same rule as a `user_entitlements` predicate, for the readers that ask
 * Postgres rather than filtering rows in memory. `revokeEntitlement` stamps
 * `effective_to` with the instant of the revoke, so the comparison is strict:
 * a grant revoked at `now` is not live at `now`.
 */
export function liveGrantAt(now: Date): SQL {
  return and(
    lte(userEntitlements.effectiveFrom, now),
    or(isNull(userEntitlements.effectiveTo), gt(userEntitlements.effectiveTo, now))
  )!;
}

/** The live grants one person holds, as a predicate. */
export function liveGrantsForUser(userId: string, now: Date): SQL {
  return and(eq(userEntitlements.userId, userId), liveGrantAt(now))!;
}
