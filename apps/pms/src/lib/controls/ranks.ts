import { and, eq } from "drizzle-orm";
import { signingShift, type SigningShift } from "@pms/controls-engine";
import { users } from "@pms/db";
import { isRole, meetsRole, ROLE_RANK, type Role } from "../auth/roles";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "./events";
import { lockTenantGrants } from "./locks";
import { refreshSodFindings, type FindingsRefreshSummary } from "./findings";
import { loadControlsContext } from "./practiceState";
import { precogRole } from "./people";

/**
 * The rank a person holds, and changing it (Increment 1.78).
 *
 * Until now nothing in this product wrote `users.role`. The only
 * `insert(users)` hard-codes `readonly` for the outside accountant's seat,
 * and the auth store updates `active`, the second-factor columns and the
 * password and nothing else. So a practice arrived with whatever ranks it was
 * seeded with and kept them forever.
 *
 * That was the root cause behind two increments. Increment 1.75 found that a
 * practice with one administrator can never close a month, because the GL
 * mapping control needs a second decider, and answered it with a governed
 * exception. Increment 1.77 found the same shape in the recovery ceremony and
 * refused to give it an exception — telling such a practice to **appoint a
 * second administrator**, which is an instruction this product could not
 * obey. A refusal that names an impossible remedy is worse than no refusal,
 * so making that sentence true is this increment's first job.
 *
 * ## What a rank actually moves, and what it does not
 *
 * This increment set out to put a promotion through the gate `evaluateGrant`
 * applies, on the reasoning that `precogRole` maps `role === "admin"` onto
 * "Owner / Dentist" and so a promotion moves duties. **Half of that is
 * wrong, and the half that is wrong is the half that would have shipped a
 * check that never fires.**
 *
 * `detectSodConflicts` scores duty combinations from *entitlements*, and this
 * app builds its assignments with `assignmentsFromGrants`, which reads live
 * grant rows and deliberately infers nothing from a label (the `ROLE_TEMPLATES`
 * path runs only when a caller passes no assignments, which this app never
 * does). So a change of rank grants nothing, creates no conflict, and a
 * decision gate modelled on the grant path would have refused nothing ever.
 * A probe over the engine's own fixtures confirmed it: every promotion
 * returned zero new conflicts.
 *
 * What a rank *does* move is **signing power**. `listEligibleApprovers` reads
 * `firstApproverRoles` and `secondApproverRoles` against the label, so
 * promoting somebody changes which releases they may start and second with no
 * entitlement granted. It still does not let one person be both halves:
 * `evaluateRelease` filters the initiator out of the eligible seconds.
 *
 * So this act reports rather than refuses: `signingShift` names the channels
 * the change opens and closes, the screen says so before the practice acts,
 * and the chain records it afterwards.
 *
 * ## One administrator may appoint another, deliberately
 *
 * Requiring two administrators to make a third is circular: a practice with
 * one could never reach two, and Increment 1.77's refusal would go on naming
 * a remedy nobody can take. Appointing does not escalate the appointer
 * either — they already hold every administrator power, and a second
 * administrator dilutes that rather than extending it.
 *
 * What one administrator appointing a confederate defeats is the two-person
 * rule itself, by supplying both people. No software prevents a practice
 * hiring an accomplice. What software can do is make every appointment a
 * dated fact naming who appointed whom, on the chain, with the duty
 * concentration it creates reported on Practice Risk. This increment does
 * that and claims nothing more.
 */

export type RankChangeInput = {
  tenantId: string;
  actor: { id: string; name: string };
  targetUserId: string;
  rank: string;
  reason?: string;
  now?: Date;
};

export type RankRefusalCode =
  | "unknown_rank"
  | "target_not_found"
  | "target_inactive"
  | "unchanged"
  | "self_rank_change"
  | "last_administrator";

export type RankChangeResult =
  | {
      ok: true;
      userId: string;
      fromRank: Role;
      toRank: Role;
      /** The release channels this change opened and closed for that person. */
      shift: SigningShift;
      findings: FindingsRefreshSummary;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      code: RankRefusalCode;
      why: string;
      nextSteps: string[];
    };

/** Active administrators, which is what the last-administrator rule counts. */
export function administrators(rows: { id: string; role: string; active: boolean }[]): string[] {
  return rows.filter((r) => r.active && isRole(r.role) && meetsRole(r.role, "admin")).map((r) => r.id);
}

/**
 * Changes one person's rank, refusing in the same transaction anything that
 * would leave the practice unable to govern itself or would create an
 * unmitigated critical conflict.
 */
export async function changeRank(db: AppDb, input: RankChangeInput): Promise<RankChangeResult> {
  const now = input.now ?? new Date();
  if (!isRole(input.rank)) {
    return {
      ok: false,
      status: 400,
      code: "unknown_rank",
      why: `"${input.rank}" is not a rank this product has.`,
      nextSteps: [`Use one of: ${Object.keys(ROLE_RANK).join(", ")}.`],
    };
  }
  const toRank: Role = input.rank;

  /**
   * An administrator may not change their own rank, for the reason
   * `grantEntitlement` refuses a self-licensed grant: the one person who
   * cannot weigh whether this concentration of duty is safe is the person
   * receiving it. Lowering your own rank is refused with the same sentence
   * rather than allowed, because a practice whose sole administrator steps
   * down has nobody left to appoint anybody.
   */
  if (input.actor.id === input.targetUserId) {
    return {
      ok: false,
      status: 403,
      code: "self_rank_change",
      why: "You cannot change your own rank.",
      nextSteps: ["Ask a different administrator to make the change."],
    };
  }

  // Serialize evaluate-then-write per practice, exactly as a grant does:
  // without this, two concurrent changes each pass against the same
  // pre-state, and the last-administrator rule is the one that must not.
  await lockTenantGrants(db, input.tenantId);
  const ctx = await loadControlsContext(db, input.tenantId, now);
  const target = ctx.staff.rows.find((r) => r.id === input.targetUserId);
  if (!target) {
    return {
      ok: false,
      status: 404,
      code: "target_not_found",
      why: "That staff member is not in this practice.",
      nextSteps: ["Pick a staff member from the practice list."],
    };
  }
  if (!target.active) {
    return {
      ok: false,
      status: 409,
      code: "target_inactive",
      why: `${target.displayName} is deactivated; a deactivated account holds no rank worth changing.`,
      nextSteps: ["Reactivate the account first."],
    };
  }
  const fromRank = isRole(target.role) ? target.role : "readonly";
  if (fromRank === toRank) {
    return {
      ok: false,
      status: 409,
      code: "unchanged",
      why: `${target.displayName} is already ${toRank}.`,
      nextSteps: ["Nothing to do."],
    };
  }

  /**
   * The practice must keep somebody who can administer it. A practice with no
   * administrator could not appoint one, grant anything, decide anything, or
   * run a recovery — and every route that would undo that needs the rank
   * nobody now holds, so the state locks from the outside.
   *
   * **Unreachable through the route today, and kept anyway.** The route is
   * `minRank: "admin"`, and `self_rank_change` above refuses an actor who is
   * the target — so an actor lowering an administrator is a second
   * administrator, and the count cannot be one. The invariant is therefore
   * held by that refusal, and this is the net under it: the moment anything
   * else can lower or deactivate an administrator (a deactivate route, an
   * import, a support tool), the count becomes reachable, and the state it
   * prevents is the one state in this product that nothing inside it could
   * repair. `ranks.live.test.ts` exercises it by calling this function
   * directly, which is where the rule lives.
   */
  const admins = administrators(ctx.staff.rows.map((r) => ({ id: r.id, role: r.role, active: r.active ?? true })));
  if (admins.includes(target.id) && !meetsRole(toRank, "admin") && admins.length === 1) {
    return {
      ok: false,
      status: 409,
      code: "last_administrator",
      why: `${target.displayName} is the only administrator this practice has.`,
      nextSteps: [
        "Make somebody else an administrator first; then this change becomes available.",
        "A practice with no administrator could not appoint one, grant anything, or bring back somebody locked out.",
      ],
    };
  }

  const shift = signingShift(ctx.policy, ctx.staff.people, target.id, precogRole({ role: toRank, entitlements: target.entitlements }));

  await db
    .update(users)
    .set({ role: toRank })
    .where(and(eq(users.tenantId, input.tenantId), eq(users.id, target.id)));

  /**
   * The findings are refreshed even though a rank creates no conflict,
   * because each stored conflict row carries the person's label: leaving them
   * alone would make the SoD view name somebody by a rank they no longer
   * hold, which is a status that can disagree with the rows under it.
   */
  const after = await loadControlsContext(db, input.tenantId, now);
  const findings = await refreshSodFindings(db, input.tenantId, after.built.sod, now, after.decisions);

  // Flat payload only: the chain hasher binds top-level keys and arrays of
  // primitives, not the keys of nested objects (see events.ts).
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "role.rank_changed",
    {
      userId: target.id,
      fromRank,
      toRank,
      reason: input.reason?.trim() || null,
      gainedInitiate: shift.gainedInitiate,
      gainedSecond: shift.gainedSecond,
      lostInitiate: shift.lostInitiate,
      lostSecond: shift.lostSecond,
    },
    now
  );

  return { ok: true, userId: target.id, fromRank, toRank, shift, findings };
}
