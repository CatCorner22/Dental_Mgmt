/**
 * Second adversarial swarm, controls-engine lens. Every test here asserts
 * the CORRECT behaviour, so it fails on the reference commit and passes
 * once the defect is fixed. The failing assertion is the measured breach.
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

describe("swarm2 controls-engine", () => {
  // Negative control: with only the hold in the policy the same request is blocked_missing_second (dual-release.test.ts "the after-hours hold").
  it("S2-controls-engine-1: a more specific raise or waive exception must not override the after-hours hold", () => {
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
    const policy = mergeDualReleasePolicy({
      enabled: true,
      hardBlockWithoutSecond: true,
      exceptions: [AFTER_HOURS_HOLD_EXCEPTION, personRaise],
    });
    const afterHours = evaluateRelease(
      policy,
      { channel: "writeoff", amountUsd: 300, initiatorPersonId: "p2", outsideBusinessHours: true },
      people,
    );
    // docs/05: "default policy holds refund/adjustment/write-off outside hours at any amount".
    expect(afterHours.dualRequired).toBe(true);
    expect(afterHours.status).toBe("blocked_missing_second");
    expect(afterHours.appliedException?.id).toBe(AFTER_HOURS_HOLD_EXCEPTION.id);
  });

  // Negative control: the same decision on c-sod-cash flips rule-cash-rec's residualRiskAccepted to true on the reference commit.
  it("S2-controls-engine-2: an accept_residual decision on c-pms-admin must reach the rule-admin-pay conflict it governs", () => {
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
    // Coverage already counts the conflict as decided; the detector must agree.
    expect(decisionCoverage(built.sod.conflicts, [accept], AS_OF).coveragePct).toBe(100);
    expect(conflict?.residualRiskAccepted).toBe(control?.residualRiskAccepted);
    expect(built.sod.summary.openWithoutAcceptance).toBe(0);
  });

  // Negative control: with only the accept_residual decision, residualRiskAccepted is true and the score drops from 99 to 81.
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
    const grants = [grant("post_payments"), grant("bank_reconcile")];
    const undecided = buildPracticeState({ people: oneManager, grants, policy: OFF_POLICY, decisions: [], enforcement: ENFORCEMENT, asOf: AS_OF });
    const built = buildPracticeState({ people: oneManager, grants, policy: OFF_POLICY, decisions: [accept, remediate], enforcement: ENFORCEMENT, asOf: AS_OF });
    expect(latestDecisionFor([accept, remediate], "control", "c-sod-cash")?.kind).toBe("remediate");
    const conflict = built.sod.conflicts.find((c) => c.ruleId === "rule-cash-rec")!;
    // remediate "licenses nothing" (decisions.ts reviewPlan): no residual credit, conflict stays open.
    expect(conflict.residualRiskAccepted).toBe(false);
    expect(conflict.score).toBe(undecided.sod.conflicts[0].score);
    expect(built.sod.summary.openWithoutAcceptance).toBe(1);
    expect(built.state.controls.find((c) => c.id === "c-sod-cash")?.residualRiskAccepted).toBe(false);
  });

  // Negative control: the same decision with reviewBy 2026-12-01 legitimately yields residualRiskAccepted true and coveragePct 100.
  it("S2-controls-engine-4: an accept_residual decision past its review date must stop discounting the SoD score", () => {
    const overdue = decision({ id: "d3", kind: "accept_residual", subjectId: "c-sod-cash", reviewBy: "2026-09-01" });
    const grants = [grant("post_payments"), grant("bank_reconcile")];
    const undecided = buildPracticeState({ people: oneManager, grants, policy: OFF_POLICY, decisions: [], enforcement: ENFORCEMENT, asOf: AS_OF });
    const built = buildPracticeState({ people: oneManager, grants, policy: OFF_POLICY, decisions: [overdue], enforcement: ENFORCEMENT, asOf: AS_OF });
    const coverage = decisionCoverage(built.sod.conflicts, [overdue], AS_OF);
    expect(coverage.overdue.length).toBe(1);
    expect(coverage.coveragePct).toBe(0);
    const conflict = built.sod.conflicts.find((c) => c.ruleId === "rule-cash-rec")!;
    // docs/13 item 21: "Nothing auto-renews"; the snapshot must not call the conflict both overdue and accepted.
    expect(conflict.residualRiskAccepted).toBe(false);
    expect(conflict.score).toBe(undecided.sod.conflicts[0].score);
    expect(built.sod.summary.openWithoutAcceptance).toBe(1);
  });

  // Negative control: explicit-rule conflicts (rule-cash-rec) keep the id `u1:rule-cash-rec` under either entitlement order.
  it("S2-controls-engine-5: a family-level conflict must keep one id and ruleId whichever order the grants arrive in", () => {
    const state = ridgeviewPractice();
    const detect = (entitlements: EntitlementId[]) =>
      detectSodConflicts(state, { assignments: [{ personId: "u1", personName: "A", role: "Biller", entitlements }] });
    const forward = detect(["post_adjustments", "bank_reconcile"]);
    const reversed = detect(["bank_reconcile", "post_adjustments"]);
    expect(forward.conflicts).toHaveLength(1);
    expect(reversed.conflicts).toHaveLength(1);
    const onFinding = decision({
      id: "d4",
      kind: "accept_residual",
      subjectKind: "sod_finding",
      subjectId: forward.conflicts[0].id,
      reviewBy: "2026-12-01",
    });
    // The decision recorded on the finding must still govern it after the rows come back in another order.
    expect(decisionCoverage(reversed.conflicts, [onFinding], AS_OF).coveragePct).toBe(100);
    expect(reversed.conflicts[0].ruleId).toBe(forward.conflicts[0].ruleId);
    expect(reversed.conflicts[0].id).toBe(forward.conflicts[0].id);
  });

  // Negative control: a grant whose effectiveTo is yesterday (2026-09-16T17:00:00Z) is correctly dropped.
  it("S2-controls-engine-6: a day pass that ends later today is still a live grant for SoD until it ends", () => {
    const { assignments } = assignmentsFromGrants(
      oneManager,
      [grant("post_payments"), grant("bank_reconcile", `${AS_OF}T08:00:00Z`, `${AS_OF}T17:00:00Z`)],
      AS_OF,
    );
    // apps/pms loadStaff isLive: effectiveTo > now means live; the engine must not end the pass a day early.
    expect(assignments[0].entitlements).toEqual(["post_payments", "bank_reconcile"]);
    const report = detectSodConflicts(ridgeviewPractice(), { assignments });
    expect(report.conflicts.map((c) => c.ruleId)).toContain("rule-cash-rec");
  });
});
