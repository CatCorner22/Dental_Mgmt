import { describe, expect, it } from "vitest";
import {
  AS_OF,
  ENFORCEMENT_INCREMENT_1_12,
  liveGrants,
  livePeople,
  livePolicy,
} from "./fixtures/live-grants";
import { mitigatedRuleIdsForScoring } from "./coverage";
import { assignmentsFromGrants, evaluateGrant, isEntitlementId } from "./grants";
import { buildPracticeState } from "./practice-state-builder";

function built(enforcement = ENFORCEMENT_INCREMENT_1_12) {
  return buildPracticeState({
    people: livePeople,
    grants: liveGrants,
    policy: livePolicy(),
    decisions: [],
    enforcement,
    asOf: AS_OF,
  });
}

describe("assignmentsFromGrants", () => {
  it("uses live grants only, drops expired rows, and reports unknown vocabulary", () => {
    const { assignments, unknownEntitlements } = assignmentsFromGrants(livePeople, liveGrants, AS_OF);
    const bill = assignments.find((a) => a.personId === "u-bill")!;
    expect(bill.entitlements).not.toContain("bank_reconcile");
    expect(bill.entitlements).toEqual(["submit_claims", "post_adjustments", "approve_writeoffs"]);
    expect(unknownEntitlements).toEqual([{ personId: "u-hyg", entitlement: "view_schedule" }]);
    // A person with no grant still appears, with nothing inferred from their role.
    const hyg = assignments.find((a) => a.personId === "u-hyg")!;
    expect(hyg.entitlements).toEqual([]);
    expect(assignments).toHaveLength(livePeople.length);
  });

  it("excludes a grant that has not started yet", () => {
    const future = [
      {
        personId: "u-hyg",
        personName: "Sam Ortiz",
        role: "Hygienist",
        entitlement: "post_payments",
        effectiveFrom: "2027-01-01",
      },
    ];
    const { assignments } = assignmentsFromGrants(livePeople, future, AS_OF);
    expect(assignments.find((a) => a.personId === "u-hyg")!.entitlements).toEqual([]);
  });

  it("knows the rulebook vocabulary", () => {
    expect(isEntitlementId("post_payments")).toBe(true);
    expect(isEntitlementId("post_payment")).toBe(false);
    expect(isEntitlementId("write_off")).toBe(false);
  });
});

describe("evaluateGrant", () => {
  it("refuses a grant that creates an unmitigated critical conflict", () => {
    const b = built();
    const evaluation = evaluateGrant(
      b.state,
      b.assignments,
      { personId: "u-om", personName: "Maya Chen", role: "Office Manager", entitlement: "bank_reconcile" },
      { mitigatedRuleIds: b.detectOptions.dualReleaseMitigatedRuleIds },
    );
    expect(evaluation.ok).toBe(false);
    expect(evaluation.requiresDecision).toBe(true);
    expect(evaluation.maxSeverity).toBe("critical");
    expect(evaluation.refusal?.code).toBe("sod_critical_conflict");
    expect(evaluation.newConflicts.map((c) => c.ruleId)).toContain("rule-cash-rec");
    expect(evaluation.refusal?.nextSteps[0]).toMatch(/control decision/);
  });

  it("does not require a decision when the only new conflicts are family-level", () => {
    const b = built();
    const evaluation = evaluateGrant(
      b.state,
      b.assignments,
      { personId: "u-front", personName: "Jordan Blake", role: "Front Desk Lead", entitlement: "submit_claims" },
      { mitigatedRuleIds: b.detectOptions.dualReleaseMitigatedRuleIds },
    );
    expect(evaluation.ok).toBe(true);
    expect(evaluation.requiresDecision).toBe(false);
    expect(evaluation.newConflicts.length).toBeGreaterThan(0);
    expect(evaluation.newConflicts.every((c) => c.severity === "family")).toBe(true);
    expect(evaluation.maxSeverity).toBe("family");
  });

  it("reports an unknown entitlement instead of scoring it", () => {
    const b = built();
    const evaluation = evaluateGrant(b.state, b.assignments, {
      personId: "u-front",
      personName: "Jordan Blake",
      role: "Front Desk Lead",
      entitlement: "write_off",
    });
    expect(evaluation.ok).toBe(false);
    expect(evaluation.refusal?.code).toBe("unknown_entitlement");
    expect(evaluation.entitlement).toBeNull();
  });

  it("treats a grant the person already holds as adding nothing", () => {
    const b = built();
    const evaluation = evaluateGrant(b.state, b.assignments, {
      personId: "u-om",
      personName: "Maya Chen",
      role: "Office Manager",
      entitlement: "post_payments",
    });
    expect(evaluation.alreadyHeld).toBe(true);
    expect(evaluation.newConflicts).toEqual([]);
    expect(evaluation.ok).toBe(true);
  });

  it("credits dual release only from a channel that counts toward scores", () => {
    const grant = {
      personId: "u-om",
      personName: "Maya Chen",
      role: "Office Manager",
      entitlement: "bank_reconcile",
    };
    // Deposit is external in this increment: rule-cash-rec stays unmitigated.
    const external = built();
    const refused = evaluateGrant(external.state, external.assignments, grant, {
      mitigatedRuleIds: external.detectOptions.dualReleaseMitigatedRuleIds,
    });
    expect(refused.requiresDecision).toBe(true);

    // If the product enforced deposits, the same grant would be mitigated.
    const enforcedDeposit = { ...ENFORCEMENT_INCREMENT_1_12, deposit: "enforced" as const };
    const mitigated = mitigatedRuleIdsForScoring(livePolicy(), enforcedDeposit, AS_OF);
    expect(mitigated.has("rule-cash-rec")).toBe(true);
    const b2 = built(enforcedDeposit);
    const allowed = evaluateGrant(b2.state, b2.assignments, grant, { mitigatedRuleIds: mitigated });
    expect(allowed.requiresDecision).toBe(false);
    expect(allowed.newConflicts.find((c) => c.ruleId === "rule-cash-rec")?.dualReleaseMitigated).toBe(true);
  });

  it("evaluates a person who holds no grant yet", () => {
    const b = built();
    const evaluation = evaluateGrant(b.state, b.assignments, {
      personId: "u-new",
      personName: "New Hire",
      role: "Front Desk Lead",
      entitlement: "collect_cash",
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.newConflicts).toEqual([]);
    expect(evaluation.reportAfter.assignments.some((a) => a.personId === "u-new")).toBe(true);
  });
});
