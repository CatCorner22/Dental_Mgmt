import { controlDecisionInputs, type ControlDecision } from "@pms/controls-engine";
import { describe, expect, it } from "vitest";
import { overdueDecisionCandidate, overdueDecisions } from "./controls/detectors";

/**
 * Swarm 2, regression hunt after swarm2/fix-harness, lens monorepo.
 * The fix branch made buildPracticeState drop a decision once its review
 * date has passed (practice-state-builder.ts, `current`); the unreviewed
 * decision detector that describes that same decision was not updated.
 */

const decision: ControlDecision = {
  id: "d-1",
  subjectKind: "control",
  subjectId: "c-cash",
  kind: "accept_residual",
  note: "Owner counts the drawer nightly.",
  reviewBy: "2026-09-01",
  decidedById: "u-owner",
  decidedByName: "Riley Owner",
  decidedAt: "2026-06-01T12:00:00.000Z",
};

describe("S2-regress-monorepo: controls surfaces", () => {
  // Negative control: dropping "It still governs until a new decision supersedes it." from overdueDecisionSentence makes this pass.
  it("S2-regress-monorepo-2: the overdue-decision finding does not claim a decision still governs once the controls registry has stopped honouring it", () => {
    const asOf = "2026-09-17";
    const inputs = controlDecisionInputs([decision], undefined, asOf);
    // The registry side: an accept-residual past its review date no longer accepts the residual.
    expect(inputs.residualAcceptedControlIds.has("c-cash")).toBe(false);

    const [overdue] = overdueDecisions([decision], asOf);
    expect(overdue).toMatchObject({ decisionId: "d-1", subjectId: "c-cash", daysOverdue: 16 });
    const sentence = String(overdueDecisionCandidate(overdue!).detail.sentence);
    // The finding side must describe the same state: the decision is due and no longer governs.
    expect(sentence).not.toMatch(/still governs/i);
  });
});
