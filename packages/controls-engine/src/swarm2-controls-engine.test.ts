/**
 * Second adversarial swarm, controls-engine lens (verified set).
 *
 * Every test asserts the CORRECT behaviour, so it FAILS on the reference
 * commit (f4032b3) and passes once the defect is fixed. Each test first
 * asserts its negative control (the path that is right today) so the
 * breach assertion that follows cannot pass vacuously.
 *
 * Verifier's negative-control results (temporary source patch, reverted):
 *  1  preferring any matching force_dual in evaluateRelease      -> passes
 *  2  linkedControlId: "c-pms-admin" on rule-admin-pay          -> passes
 *  3  controlDecisionInputs consulting latestDecisionFor         -> passes
 *  4  controlDecisionInputs skipping reviewBy < asOf (both the
 *     direct control branch AND the every-conflict-accepted
 *     template inference)                                        -> passes
 *  5  sorting [a,b] / [fa,fb] before composing family ids        -> passes
 *  6  comparing full ISO effectiveTo against the asOf instant    -> passes
 */
import { describe, expect, it } from "vitest";
import {
  AFTER_HOURS_HOLD_EXCEPTION,
  evaluateRelease,
  mergeDualReleasePolicy,
  type ThresholdException,
} from "./controls/dual-release";
import { decisionCoverage, latestDecisionFor, type ControlDecision } from "./decisions";
import { ridgeviewPractice } from "./fixtures/ridgeview";
import { assignmentsFromGrants } from "./grants";
import { buildPracticeState } from "./practice-state-builder";
import { detectSodConflicts } from "./sod/detect";
import type { EntitlementId } from "./sod/conflict-rules";
import type { EnforcementByChannel } from "./coverage";

const ENFORCEMENT: EnforcementByChannel = {
  ach: "partial",
  check: "partial",
  writeoff: "enforced",
  vendor_new: "external",
  deposit: "enforced",
  payroll: "external",
};

const AS_OF = "2026-09-17";
const OFF_POLICY = mergeDualReleasePolicy({ enabled: false, exceptions: [] });

const oneManager = [{ id: "u1", name: "A", role: "Office Manager", active: true, tenureYears: 1 }];
function grant(entitlement: EntitlementId, effectiveFrom = "2026-01-01", effectiveTo: string | null = null) {
  return { personId: "u1", personName: "A", role: "Office Manager", entitlement, effectiveFrom, effectiveTo };
}
function decision(partial: Partial<ControlDecision> & Pick<ControlDecision, "id" | "kind" | "subjectId">): ControlDecision {
  return {
    subjectKind: "control",
    note: "accepted for now, reviewed quarterly",
    decidedById: "owner",
    decidedByName: "Owner",
    decidedAt: "2026-09-01T00:00:00Z",
    ...partial,
  };
}
function cashRecState(decisions: ControlDecision[]) {
  return buildPracticeState({
    people: oneManager,
    grants: [grant("post_payments"), grant("bank_reconcile")],
    policy: OFF_POLICY,
    decisions,
    enforcement: ENFORCEMENT,
    asOf: AS_OF,
  });
}

describe("swarm2 controls-engine", () => {
  it("S2-controls-engine-1: a more specific raise_threshold or waive_dual exception must not outrank the after-hours force_dual hold", () => {
    const people = ridgeviewPractice().people;
    const personRaise: ThresholdException = {
      id: "ex-om-writeoff-raise",
      label: "Office manager write-off raise",
      channels: ["writeoff"],
      action: "raise_threshold",
      thresholdUsd: 750,
      personId: "p2",
      enabled: true,
      reason: "Temporary raise for the office manager while the owner travels.",
      approvedByPersonId: "p1",
      residualNote: "Reviewed weekly.",
      createdAt: "2026-09-01",
      effectiveTo: "2026-12-31",
    };
    const payeeWaiver: ThresholdException = {
      id: "ex-payee-waiver",
      label: "Payroll vendor waiver",
      channels: ["check"],
      action: "waive_dual",
      payeeContains: "ADP",
      enabled: true,
      reason: "Recurring payroll vendor.",
      approvedByPersonId: "p1",
      residualNote: "Reviewed weekly.",
      createdAt: "2026-09-01",
      effectiveTo: "2026-10-01",
    };
    const holdOnly = mergeDualReleasePolicy({ enabled: true, hardBlockWithoutSecond: true, exceptions: [AFTER_HOURS_HOLD_EXCEPTION] });
    const policy = mergeDualReleasePolicy({
      enabled: true,
      hardBlockWithoutSecond: true,
      exceptions: [AFTER_HOURS_HOLD_EXCEPTION, personRaise, payeeWaiver],
    });
    const writeoff = { channel: "writeoff" as const, amountUsd: 300, initiatorPersonId: "p2" };
    const check = { channel: "check" as const, amountUsd: 900, initiatorPersonId: "p2", payee: "ADP Payroll" };

    // Negative controls: the hold alone blocks after hours; the raise/waiver alone apply during hours.
    expect(evaluateRelease(holdOnly, { ...writeoff, outsideBusinessHours: true }, people).status).toBe("blocked_missing_second");
    expect(evaluateRelease(holdOnly, { ...check, outsideBusinessHours: true }, people).status).toBe("blocked_missing_second");
    expect(evaluateRelease(policy, { ...writeoff, outsideBusinessHours: false }, people)).toMatchObject({
      status: "approved_exception",
      dualRequired: false,
      appliedException: { id: personRaise.id },
    });
    expect(evaluateRelease(policy, { ...check, outsideBusinessHours: false }, people)).toMatchObject({
      status: "approved_exception",
      dualRequired: false,
      appliedException: { id: payeeWaiver.id },
    });

    // docs/05: the default policy holds refund/adjustment/write-off outside hours at any amount.
    // A raise or waiver that happens to be more specific must not discard the force_dual match.
    const afterHoursWriteoff = evaluateRelease(policy, { ...writeoff, outsideBusinessHours: true }, people);
    expect(afterHoursWriteoff.dualRequired).toBe(true);
    expect(afterHoursWriteoff.status).toBe("blocked_missing_second");
    expect(afterHoursWriteoff.appliedException?.id).toBe(AFTER_HOURS_HOLD_EXCEPTION.id);

    const afterHoursCheck = evaluateRelease(policy, { ...check, outsideBusinessHours: true }, people);
    expect(afterHoursCheck.dualRequired).toBe(true);
    expect(afterHoursCheck.status).toBe("blocked_missing_second");
    expect(afterHoursCheck.appliedException?.id).toBe(AFTER_HOURS_HOLD_EXCEPTION.id);
  });

  it("S2-controls-engine-2: an accept_residual decision on c-pms-admin must reach the rule-admin-pay conflict it governs", () => {
    // Negative control: the same decision on c-sod-cash reaches rule-cash-rec (linkedControlId is set on that rule).
    const acceptCash = decision({ id: "d0", kind: "accept_residual", subjectId: "c-sod-cash", reviewBy: "2026-12-01" });
    const cash = cashRecState([acceptCash]);
    expect(cash.sod.conflicts.find((c) => c.ruleId === "rule-cash-rec")?.residualRiskAccepted).toBe(true);
    expect(cash.sod.summary.openWithoutAcceptance).toBe(0);

    const accept = decision({ id: "d1", kind: "accept_residual", subjectId: "c-pms-admin", reviewBy: "2026-12-01" });
    const built = buildPracticeState({
      people: oneManager,
      grants: [grant("pms_admin_roles"), grant("post_payments")],
      policy: OFF_POLICY,
      decisions: [accept],
      enforcement: ENFORCEMENT,
      asOf: AS_OF,
    });
    const conflict = built.sod.conflicts.find((c) => c.ruleId === "rule-admin-pay");
    const control = built.state.controls.find((c) => c.id === "c-pms-admin");
    expect(conflict).toBeDefined();
    expect(control?.residualRiskAccepted).toBe(true);
    // Coverage (via controlIdForRule -> template) already counts the conflict as decided; the detector must agree.
    expect(decisionCoverage(built.sod.conflicts, [accept], AS_OF).coveragePct).toBe(100);
    expect(conflict?.residualRiskAccepted).toBe(true);
    expect(built.sod.summary.openWithoutAcceptance).toBe(0);
  });

  it("S2-controls-engine-3: a later remediate decision on the same control must stop the earlier accept_residual from licensing the conflict", () => {
    const accept = decision({ id: "d1", kind: "accept_residual", subjectId: "c-sod-cash", reviewBy: "2026-12-01" });
    const remediate = decision({
      id: "d2",
      kind: "remediate",
      subjectId: "c-sod-cash",
      note: "we will split posting from reconciliation",
      reviewBy: "2026-10-01",
      decidedAt: "2026-09-10T00:00:00Z",
    });
    const undecided = cashRecState([]);
    const baseline = undecided.sod.conflicts.find((c) => c.ruleId === "rule-cash-rec")!;

    // Negative control: the acceptance alone is the intended credit.
    const acceptedOnly = cashRecState([accept]).sod.conflicts.find((c) => c.ruleId === "rule-cash-rec")!;
    expect(acceptedOnly.residualRiskAccepted).toBe(true);
    expect(acceptedOnly.score).toBeLessThan(baseline.score);

    // recordDecision (apps/pms) accepts a remediate on the same subject without supersedesDecisionId, so both rows stay active.
    const built = cashRecState([accept, remediate]);
    expect(latestDecisionFor([accept, remediate], "control", "c-sod-cash")?.kind).toBe("remediate");
    expect(decisionCoverage(built.sod.conflicts, [accept, remediate], AS_OF).decided.map((d) => d.decision.kind)).toEqual(["remediate"]);
    const conflict = built.sod.conflicts.find((c) => c.ruleId === "rule-cash-rec")!;
    // remediate "licenses nothing" (decisions.ts reviewPlan): no residual credit, conflict stays open.
    expect(conflict.residualRiskAccepted).toBe(false);
    expect(conflict.score).toBe(baseline.score);
    expect(built.sod.summary.openWithoutAcceptance).toBe(1);
    expect(built.state.controls.find((c) => c.id === "c-sod-cash")?.residualRiskAccepted).toBe(false);
  });

  it("S2-controls-engine-4: an accept_residual decision past its review date must stop discounting the SoD score", () => {
    const undecided = cashRecState([]);
    const baseline = undecided.sod.conflicts.find((c) => c.ruleId === "rule-cash-rec")!;

    // Negative control: the same decision still in review is the intended credit and coverage agrees.
    const current = decision({ id: "d3", kind: "accept_residual", subjectId: "c-sod-cash", reviewBy: "2026-12-01" });
    const currentState = cashRecState([current]);
    expect(decisionCoverage(currentState.sod.conflicts, [current], AS_OF).coveragePct).toBe(100);
    expect(currentState.sod.conflicts.find((c) => c.ruleId === "rule-cash-rec")?.residualRiskAccepted).toBe(true);

    const overdue = decision({ id: "d4", kind: "accept_residual", subjectId: "c-sod-cash", reviewBy: "2026-09-01" });
    const built = cashRecState([overdue]);
    const coverage = decisionCoverage(built.sod.conflicts, [overdue], AS_OF);
    expect(coverage.overdue.length).toBe(1);
    expect(coverage.coveragePct).toBe(0);
    const conflict = built.sod.conflicts.find((c) => c.ruleId === "rule-cash-rec")!;
    // docs/13 item 21: "Nothing auto-renews"; the snapshot must not call the conflict both overdue and accepted.
    expect(conflict.residualRiskAccepted).toBe(false);
    expect(conflict.score).toBe(baseline.score);
    expect(built.sod.summary.openWithoutAcceptance).toBe(1);
    expect(built.state.controls.find((c) => c.id === "c-sod-cash")?.residualRiskAccepted).toBe(false);
  });

  it("S2-controls-engine-5: a family-level conflict must keep one id and ruleId whichever order the grants arrive in", () => {
    const state = ridgeviewPractice();
    const detect = (entitlements: EntitlementId[]) =>
      detectSodConflicts(state, { assignments: [{ personId: "u1", personName: "A", role: "Biller", entitlements }] });

    // Negative control: explicit-rule conflicts keep `${personId}:${rule.id}` under either order.
    expect(detect(["post_payments", "bank_reconcile"]).conflicts.map((c) => c.id)).toEqual(["u1:rule-cash-rec"]);
    expect(detect(["bank_reconcile", "post_payments"]).conflicts.map((c) => c.id)).toEqual(["u1:rule-cash-rec"]);

    const forward = detect(["post_adjustments", "bank_reconcile"]);
    const reversed = detect(["bank_reconcile", "post_adjustments"]);
    expect(forward.conflicts).toHaveLength(1);
    expect(reversed.conflicts).toHaveLength(1);
    expect(forward.conflicts[0].ruleId.startsWith("family-")).toBe(true);
    const onFinding = decision({
      id: "d5",
      kind: "accept_residual",
      subjectKind: "sod_finding",
      subjectId: forward.conflicts[0].id,
      reviewBy: "2026-12-01",
    });
    expect(decisionCoverage(forward.conflicts, [onFinding], AS_OF).coveragePct).toBe(100);
    // The decision recorded on the finding must still govern it after the rows come back in another order
    // (loadStaff's user_entitlements select has no ORDER BY; the findings upsert key is `${ruleId}|${personId}`).
    expect(decisionCoverage(reversed.conflicts, [onFinding], AS_OF).coveragePct).toBe(100);
    expect(reversed.conflicts[0].ruleId).toBe(forward.conflicts[0].ruleId);
    expect(reversed.conflicts[0].id).toBe(forward.conflicts[0].id);
  });

  it("S2-controls-engine-6: a grant whose ISO effectiveTo is later today is still live for SoD until it ends", () => {
    const passUntil = (effectiveTo: string) =>
      assignmentsFromGrants(oneManager, [grant("post_payments"), grant("bank_reconcile", `${AS_OF}T08:00:00Z`, effectiveTo)], AS_OF)
        .assignments[0].entitlements;

    // Negative controls: a pass that ended yesterday is dropped; one ending tomorrow is kept.
    expect(passUntil("2026-09-16T17:00:00Z")).toEqual(["post_payments"]);
    expect(passUntil("2026-09-18T17:00:00Z")).toEqual(["post_payments", "bank_reconcile"]);

    // GrantRow documents effectiveTo as "ISO timestamp or date"; apps/pms loadStaff.isLive treats
    // effectiveTo > now as live, so the engine must not end the same rows a day early.
    const entitlements = passUntil(`${AS_OF}T17:00:00Z`);
    expect(entitlements).toEqual(["post_payments", "bank_reconcile"]);
    const report = detectSodConflicts(ridgeviewPractice(), {
      assignments: [{ personId: "u1", personName: "A", role: "Office Manager", entitlements }],
    });
    expect(report.conflicts.map((c) => c.ruleId)).toContain("rule-cash-rec");
  });
});
