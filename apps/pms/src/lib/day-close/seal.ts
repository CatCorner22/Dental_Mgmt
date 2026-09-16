import { listEligibleApprovers, type DualReleasePolicy, type Person } from "@pms/controls-engine";

/**
 * Dual count of the deposit bag before it is sealed (the `deposit` channel).
 *
 * Freezing a day close is the seal. The rulebook says two people: whoever
 * prepared the deposits counted once; the person who freezes counts again
 * and must be a different, role-eligible person. Preparation already
 * happened under its own entitlement, so only the sealer is checked here.
 * A one-person office degrades to owner-only sealing and records that as a
 * finding, the same way variance clearance does (decision 7a).
 */
export type SealActor = { id: string; name: string; role: string };

export type SealDeposit = { preparedById: string; amountCents: number };

export type CanSealInput = {
  actor: SealActor;
  deposits: SealDeposit[];
  policy: DualReleasePolicy | null;
  people: Person[];
};

export type SealStatus =
  | "policy_off"
  | "below_threshold"
  | "approved_dual"
  | "degraded_owner_seal"
  | "blocked_same_person"
  | "blocked_role";

export type SealVerdict = {
  ok: boolean;
  status: SealStatus;
  verb: string;
  why: string;
  degradedOwnerSeal: boolean;
  dualRequired: boolean;
  thresholdUsd: number;
  preparerIds: string[];
  /** Eligible second counters other than the preparers, for the refusal message. */
  otherEligibleNames: string[];
};

export function canSealDeposits(input: CanSealInput): SealVerdict {
  const preparerIds = Array.from(new Set(input.deposits.map((d) => d.preparedById)));
  const totalCents = input.deposits.reduce((s, d) => s + Math.abs(d.amountCents), 0);
  const rule = input.policy?.rules.find((r) => r.channel === "deposit");
  const base = { degradedOwnerSeal: false, preparerIds, otherEligibleNames: [] as string[] };

  if (!input.policy || !input.policy.enabled || !rule || !rule.enabled) {
    return {
      ok: true,
      status: "policy_off",
      verb: "Freeze",
      why: "Dual release is not configured for deposits; the seal is recorded, not enforced.",
      dualRequired: false,
      thresholdUsd: rule?.thresholdUsd ?? 0,
      ...base,
    };
  }

  const thresholdUsd = rule.thresholdUsd;
  if (totalCents <= Math.round(thresholdUsd * 100)) {
    return {
      ok: true,
      status: "below_threshold",
      verb: "Freeze",
      why: `Deposit total is at or under the $${thresholdUsd.toLocaleString()} threshold; one count is enough.`,
      dualRequired: false,
      thresholdUsd,
      ...base,
    };
  }

  const seconds = listEligibleApprovers(input.policy, "deposit", input.people).filter((p) => p.canSecond);
  const actorEligible = seconds.some((p) => p.id === input.actor.id) || input.actor.role === "admin";
  const otherEligible = seconds.filter((p) => p.id !== input.actor.id && !preparerIds.includes(p.id));
  const otherEligibleNames = otherEligible.map((p) => p.name);
  const actorPrepared = preparerIds.includes(input.actor.id);

  if (actorPrepared) {
    if (input.actor.role === "admin" && otherEligible.length === 0) {
      return {
        ok: true,
        status: "degraded_owner_seal",
        verb: "Freeze as owner",
        why: "Nobody else can count this deposit. Owner-only sealing will be recorded as a finding.",
        degradedOwnerSeal: true,
        dualRequired: true,
        thresholdUsd,
        preparerIds,
        otherEligibleNames,
      };
    }
    return {
      ok: false,
      status: "blocked_same_person",
      verb: "Needs someone other than the deposit preparer",
      why: "Whoever prepared this day's deposit cannot seal it; a second person counts before the bag closes.",
      dualRequired: true,
      thresholdUsd,
      preparerIds,
      otherEligibleNames,
      degradedOwnerSeal: false,
    };
  }

  if (!actorEligible) {
    return {
      ok: false,
      status: "blocked_role",
      verb: "Needs an eligible second counter",
      why: `${input.actor.name} may not second a deposit under the practice's dual-release policy. Allowed: ${rule.secondApproverRoles.join(", ")}.`,
      dualRequired: true,
      thresholdUsd,
      preparerIds,
      otherEligibleNames,
      degradedOwnerSeal: false,
    };
  }

  return {
    ok: true,
    status: "approved_dual",
    verb: "Freeze",
    why: "Second count by a different, eligible person.",
    dualRequired: true,
    thresholdUsd,
    preparerIds,
    otherEligibleNames,
    degradedOwnerSeal: false,
  };
}
