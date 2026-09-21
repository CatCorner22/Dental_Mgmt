import { and, eq, isNull } from "drizzle-orm";
import { sessions, userEntitlements, users } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "./events";
import { refreshSodFindings, type FindingsRefreshSummary } from "./findings";
import { lockTenantGrants } from "./locks";
import { loadControlsContext } from "./practiceState";
import { administrators } from "./ranks";

/**
 * Who is still on the practice (Increment 1.79).
 *
 * `users.active` has been in the schema since Increment 0.2 and has never been
 * reachable. `deactivateUser` sits on the `AuthStore` with two callers, both
 * of them tests; no route calls it; and nothing anywhere sets the column back
 * to true except creating an account. So a practice could not remove access
 * for somebody who left — they kept their password, their second factor and
 * every grant — and could not have undone it either.
 *
 * The product already knows how to do this reversibly for a *reason code*:
 * `setReasonCodeActive` takes a direction and the screen offers both. People
 * had neither.
 *
 * ## Deactivating ends the grants, and that is the point
 *
 * `detectSodConflicts` never reads `active`, and `assignmentsFromGrants`
 * builds an assignment for every person `loadStaff` returns — inactive
 * included. So flipping the column alone would leave a departed person's duty
 * conflicts standing on Practice Risk forever: a signal that never clears,
 * which is the shape this codebase refuses everywhere else.
 *
 * Two ways out. Teaching the rulebook to skip inactive people would change
 * what it scores — every practice's conflict counts would move, and
 * `CONTROL_RULEBOOK_VERSION` would have to move with them, which is a real
 * rulebook change for a data problem. Ending the person's live grant rows
 * instead uses the mechanism already there: `assignmentsFromGrants` reads live
 * rows, so the conflicts clear by themselves, no figure is redefined, and no
 * stamp moves.
 *
 * It also makes coming back honest. Reactivating restores the account and
 * **not** the powers: every grant is granted again deliberately, through
 * `evaluateGrant`, which is where a duty is supposed to be weighed. A
 * reactivation that silently handed back six entitlements would be a grant
 * nobody decided.
 *
 * What reactivating does restore is the sign-in: the password and the second
 * factor are untouched by either direction, because a practice bringing
 * somebody back has decided to, and asking them to re-pair a phone they still
 * hold would be ceremony rather than control.
 */

export type RosterInput = {
  tenantId: string;
  actor: { id: string; name: string };
  targetUserId: string;
  /** True brings somebody back; false stands them down. */
  active: boolean;
  reason?: string;
  now?: Date;
};

export type RosterRefusalCode =
  | "target_not_found"
  | "unchanged"
  | "self_deactivation"
  | "last_administrator";

export type RosterResult =
  | {
      ok: true;
      userId: string;
      active: boolean;
      /** Grants ended by a deactivation; always empty on a reactivation. */
      endedEntitlements: string[];
      findings: FindingsRefreshSummary;
    }
  | {
      ok: false;
      status: 403 | 404 | 409;
      code: RosterRefusalCode;
      why: string;
      nextSteps: string[];
    };

/**
 * Stands somebody down, or brings them back.
 *
 * One function for both directions rather than two, because they are one
 * question about one column and a practice reading two screens would have to
 * decide which one to believe — the same reasoning `setReasonCodeActive`
 * follows for a reason code.
 */
export async function setPersonActive(db: AppDb, input: RosterInput): Promise<RosterResult> {
  const now = input.now ?? new Date();

  /**
   * You may not stand yourself down. The rule matters more here than it does
   * for a rank: `deactivateUser` revokes the sessions, so an administrator
   * doing this to themselves would be signed out mid-act, and if they were
   * the only one the practice would have nobody left to bring them back.
   *
   * Reactivating yourself needs no rule — somebody deactivated cannot sign in
   * to try.
   */
  if (!input.active && input.actor.id === input.targetUserId) {
    return {
      ok: false,
      status: 403,
      code: "self_deactivation",
      why: "You cannot stand yourself down.",
      nextSteps: ["Ask a different administrator to do it."],
    };
  }

  // Serialize evaluate-then-write per practice, as a grant and a rank change
  // both do: the last-administrator rule is the one that must not race.
  await lockTenantGrants(db, input.tenantId);
  const ctx = await loadControlsContext(db, input.tenantId, now);
  const target = ctx.staff.rows.find((r) => r.id === input.targetUserId);
  if (!target) {
    return {
      ok: false,
      status: 404,
      code: "target_not_found",
      why: "That person is not in this practice.",
      nextSteps: ["Pick somebody from the practice list."],
    };
  }
  if ((target.active ?? true) === input.active) {
    return {
      ok: false,
      status: 409,
      code: "unchanged",
      why: input.active
        ? `${target.displayName} is already on the practice.`
        : `${target.displayName} has already been stood down.`,
      nextSteps: ["Nothing to do."],
    };
  }

  /**
   * The practice must keep somebody who can administer it.
   *
   * **Still unreachable through the route, for the same reason Increment 1.78
   * gave.** This increment was planned on the belief that a deactivation
   * would finally reach it — `administrators()` counts only *active*
   * administrators, so standing one down can take the count to zero where
   * lowering a rank cannot. That belief does not survive the guard: the route
   * is `minRank: "admin"`, so the actor is an active administrator; the self
   * rule above means the target is somebody else; and if that somebody else
   * is also an administrator then there are two. The count is never one at
   * this line.
   *
   * It is kept for the reason the rank rule is kept, now under two acts
   * rather than one: the state it prevents is the only state in this product
   * that nothing inside it could repair. A practice with no administrator
   * could not appoint one, grant anything, or bring anybody back, and every
   * route that would fix that needs the rank nobody holds. The day anything
   * else can stand an administrator down — an import, a support tool, a
   * scheduled expiry — this is what is already standing there.
   *
   * `roster.live.test.ts` exercises it on the function, where the rule lives.
   * A case driving the route would pass on `self_deactivation` and prove
   * nothing.
   */
  const admins = administrators(ctx.staff.rows.map((r) => ({ id: r.id, role: r.role, active: r.active ?? true })));
  if (!input.active && admins.includes(target.id) && admins.length === 1) {
    return {
      ok: false,
      status: 409,
      code: "last_administrator",
      why: `${target.displayName} is the only administrator still on this practice.`,
      nextSteps: [
        "Make somebody else an administrator first; then this becomes available.",
        "A practice with no administrator could not appoint one, grant anything, or bring anybody back.",
      ],
    };
  }

  await db
    .update(users)
    .set({ active: input.active })
    .where(and(eq(users.tenantId, input.tenantId), eq(users.id, target.id)));

  const endedEntitlements: string[] = [];
  if (!input.active) {
    /**
     * The sessions go too, in the same transaction as the column.
     *
     * `authorize` refuses an inactive account on the next sign-in, but a
     * session already minted is not a sign-in: without this, somebody stood
     * down keeps working until their session expires on its own, which is up
     * to the absolute lifetime away. `postgresStore.deactivateUser` has always
     * paired the two; this act is the one that finally has a caller.
     */
    await db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.userId, target.id), isNull(sessions.revokedAt)));

    // Every live grant ends with them. Rows are closed, never deleted, so the
    // register still says what this person once held and when it stopped.
    const live = await db
      .select({ id: userEntitlements.id, entitlement: userEntitlements.entitlement })
      .from(userEntitlements)
      .where(
        and(
          eq(userEntitlements.tenantId, input.tenantId),
          eq(userEntitlements.userId, target.id),
          isNull(userEntitlements.effectiveTo)
        )
      );
    for (const row of live) {
      await db
        .update(userEntitlements)
        .set({ effectiveTo: now })
        .where(and(eq(userEntitlements.id, row.id), eq(userEntitlements.tenantId, input.tenantId)));
      endedEntitlements.push(row.entitlement);
    }
  }

  // Read the practice again, because both halves of this act moved it: the
  // column and, on a deactivation, the grants.
  const after = await loadControlsContext(db, input.tenantId, now);
  const findings = await refreshSodFindings(db, input.tenantId, after.built.sod, now, after.decisions);

  // Flat payload only: the chain hasher binds top-level keys and arrays of
  // primitives, not the keys of nested objects (see events.ts).
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    input.active ? "roster.reactivated" : "roster.deactivated",
    {
      userId: target.id,
      displayName: target.displayName,
      reason: input.reason?.trim() || null,
      endedEntitlements,
    },
    now
  );

  return { ok: true, userId: target.id, active: input.active, endedEntitlements, findings };
}
