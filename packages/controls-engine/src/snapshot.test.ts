import { describe, expect, it } from "vitest";
import {
  AS_OF,
  ENFORCEMENT_INCREMENT_1_12,
  liveDecisions,
  liveGrants,
  livePeople,
  livePolicy,
  TAKEN_AT,
} from "./fixtures/live-grants";
import { buildPracticeState } from "./practice-state-builder";
import { takeControlSnapshot } from "./snapshot";
import { CONTROL_RULEBOOK_VERSION, SCORING_VERSION } from "./version";

function snap(decisions = liveDecisions) {
  const b = buildPracticeState({
    people: livePeople,
    grants: liveGrants,
    policy: livePolicy(),
    decisions,
    enforcement: ENFORCEMENT_INCREMENT_1_12,
    asOf: AS_OF,
  });
  return takeControlSnapshot({
    state: b.state,
    sod: b.sod,
    coverage: b.coverage,
    decisions,
    takenAt: TAKEN_AT,
  });
}

describe("takeControlSnapshot", () => {
  it("stamps both versions and the clock it was given", () => {
    const s = snap();
    expect(s.scoringVersion).toBe(SCORING_VERSION);
    expect(s.rulebookVersion).toBe(CONTROL_RULEBOOK_VERSION);
    expect(s.takenAt).toBe(TAKEN_AT);
  });

  it("keeps the headline consistent with the detailed sections", () => {
    const s = snap();
    expect(s.headline.averageResidual).toBe(s.portfolio.averageResidual);
    expect(s.headline.cosoOverall).toBe(s.coso.overall);
    expect(s.headline.pressureIndex).toBe(s.signals.pressureIndex);
    expect(s.headline.segregationHealth).toBe(s.sod.summary.segregationHealth);
    expect(s.headline.openConflicts).toBe(s.sod.conflicts.length);
    expect(s.headline.conflictsWithoutDecision).toBe(s.decisions.openConflictIds.length);
    expect(s.headline.overdueReviews).toBe(1);
    expect(s.decisions.overdue[0]).toEqual({
      decisionId: "dec-2",
      subjectId: "u-bill:rule-writeoff",
      reviewBy: "2026-08-01",
    });
  });

  it("names every external channel and every unmeasured input as an assumption", () => {
    const s = snap();
    expect(s.assumptions.some((a) => /never a person/.test(a))).toBe(true);
    expect(s.assumptions.some((a) => /No knowledge map yet/.test(a))).toBe(true);
    expect(s.assumptions.some((a) => /bank reconciliation is not measured/.test(a))).toBe(true);
    expect(s.assumptions.some((a) => /external \/ attested, excluded from scores/.test(a))).toBe(true);
    expect(s.assumptions.find((a) => /external/.test(a))).toMatch(/Payroll transmission/);
    expect(s.assumptions.find((a) => /patient-ledger kinds only/.test(a))).toMatch(/ACH \/ vendor electronic pay, Paper checks/);
  });

  it("carries a measurement only when one was taken, and words the assumption from it", () => {
    const unmeasured = snap();
    expect("measurements" in unmeasured).toBe(false);

    const b = buildPracticeState({
      people: livePeople,
      grants: liveGrants,
      policy: livePolicy(),
      decisions: liveDecisions,
      enforcement: ENFORCEMENT_INCREMENT_1_12,
      asOf: AS_OF,
      independentBankRec: false,
    });
    const measured = takeControlSnapshot({
      state: b.state,
      sod: b.sod,
      coverage: b.coverage,
      decisions: liveDecisions,
      takenAt: TAKEN_AT,
      measurements: {
        reconciliation: {
          grade: "same_hands",
          windowDays: 45,
          clearedInWindow: 2,
          sameHandsInWindow: 1,
          latestClearedAt: "2026-09-08T18:00:00Z",
          why: "1 of 2 runs cleared in the last 45 days was cleared by someone who prepared deposits or posted payments in the period.",
        },
      },
    });
    expect(measured.measurements?.reconciliation?.grade).toBe("same_hands");
    expect(measured.assumptions.some((a) => /bank reconciliation is not measured/.test(a))).toBe(false);
    expect(measured.assumptions.find((a) => /bank reconciliation is measured/.test(a))).toMatch(
      /absent \(same hands\): 1 of 2 runs/
    );
  });

  it("is deterministic and finite", () => {
    const a = JSON.stringify(snap());
    const b = JSON.stringify(snap());
    expect(a).toBe(b);
    expect(a).not.toMatch(/Infinity|NaN/);
  });

  it("lowers nothing when decisions are added: scores describe design, decisions describe governance", () => {
    const none = snap([]);
    const some = snap();
    expect(some.headline.averageResidual).toBeLessThanOrEqual(none.headline.averageResidual);
    expect(some.headline.conflictsWithoutDecision).toBeLessThan(none.headline.conflictsWithoutDecision);
  });
});
