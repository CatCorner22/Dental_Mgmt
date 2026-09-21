import type { Person } from "./types";
import {
  listEligibleApprovers,
  type DualReleasePolicy,
  type ReleaseChannel,
} from "./controls/dual-release";

/**
 * Reading the release rules, rather than being one (Increment 1.78).
 *
 * This sits beside the rulebook instead of inside `controls/` on purpose.
 * `scripts/check-version-stamps.sh` fails any change under `src/sod`,
 * `src/controls` or `src/scoring/weights` that does not also bump
 * `CONTROL_RULEBOOK_VERSION` — and that stamp is frozen onto scored
 * artifacts, where it means "these figures were produced under this
 * rulebook". Nothing here changes an SoD pair, a dual-release default, a
 * weight or a threshold; it only reads what the rules already say. Bumping
 * the stamp for it would put a rule change into every later snapshot and
 * month-end package that never happened, and leave an auditor comparing two
 * of them asking which rule moved. The answer would be none.
 *
 * So the guard keeps its meaning — edit a rule and it still fires — and a
 * reader of the rules lives where readers live.
 */
/**
 * What a change of rank moves (Increment 1.78).
 *
 * The release rules name their signers by role **label** — `canInitiate` and
 * `canSecond` in `listEligibleApprovers` read `rule.firstApproverRoles` and
 * `rule.secondApproverRoles` against `p.role`. The app maps `role === "admin"`
 * onto "Owner / Dentist", so promoting somebody changes which releases they
 * may start and second without granting them a single entitlement.
 *
 * That is worth reporting, and it is **not** a segregation-of-duties conflict.
 * `detectSodConflicts` scores duty combinations from entitlements, and the app
 * builds its assignments with `assignmentsFromGrants`, which reads live grant
 * rows and deliberately infers nothing from a label. So a promotion adds no
 * conflict for the rulebook to refuse, and a gate modelled on `evaluateGrant`
 * would be a check that never fires.
 *
 * Nor does it let one person be both halves of a release: `evaluateRelease`
 * filters the initiator out of the eligible seconds, so two distinct people
 * are still required whatever labels they carry.
 *
 * What is left is a fact the practice should read before it acts, and an
 * auditor should read afterwards: these channels, gained or lost.
 */
export interface SigningShift {
  /** Channels the person could not start before and could after. */
  gainedInitiate: ReleaseChannel[];
  /** Channels the person could not second before and could after. */
  gainedSecond: ReleaseChannel[];
  /** Channels the person could start before and could not after. */
  lostInitiate: ReleaseChannel[];
  /** Channels the person could second before and could not after. */
  lostSecond: ReleaseChannel[];
}

function signingFor(
  policy: DualReleasePolicy,
  people: Person[],
  personId: string,
): { initiate: Set<ReleaseChannel>; second: Set<ReleaseChannel> } {
  const initiate = new Set<ReleaseChannel>();
  const second = new Set<ReleaseChannel>();
  for (const rule of policy.rules) {
    const me = listEligibleApprovers(policy, rule.channel, people).find((p) => p.id === personId);
    if (!me) continue;
    if (me.canInitiate) initiate.add(rule.channel);
    if (me.canSecond) second.add(rule.channel);
  }
  return { initiate, second };
}

/**
 * The channels one person's signing power gains and loses when their role
 * label changes. Everybody else is left exactly as they are, so the answer is
 * about this person and no one else.
 */
export function signingShift(
  policy: DualReleasePolicy,
  people: Person[],
  personId: string,
  toRole: string,
): SigningShift {
  const before = signingFor(policy, people, personId);
  const after = signingFor(
    policy,
    people.map((p) => (p.id === personId ? { ...p, role: toRole } : p)),
    personId,
  );
  const gained = (a: Set<ReleaseChannel>, b: Set<ReleaseChannel>) =>
    Array.from(a).filter((c) => !b.has(c));
  return {
    gainedInitiate: gained(after.initiate, before.initiate),
    gainedSecond: gained(after.second, before.second),
    lostInitiate: gained(before.initiate, after.initiate),
    lostSecond: gained(before.second, after.second),
  };
}
