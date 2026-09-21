import { describe, expect, it } from "vitest";
import type { ControlDecision } from "@pms/controls-engine";
import {
  SOLE_DECIDER_CONTROL,
  licenses,
  soleDeciderRefusal,
  soleDeciderSentence,
  soleDeciderStanding,
} from "./soleDecider";

/**
 * Increment 1.75. A practice with one administrator could propose a mapping
 * nobody may decide, and so close no month ever. These cases hold the rule
 * that lets it proceed, and the words it is told in.
 */

function decision(over: Partial<ControlDecision> = {}): ControlDecision {
  return {
    id: "d1",
    subjectKind: "control",
    subjectId: SOLE_DECIDER_CONTROL,
    kind: "accept_residual",
    note: "This practice has one administrator.",
    reviewBy: "2026-12-01",
    decidedById: "u1",
    decidedByName: "Riley Owner",
    decidedAt: "2026-09-21T09:00:00.000Z",
    ...over,
  };
}

describe("when one person may decide their own mapping", () => {
  it("does not, until a decision says so", () => {
    expect(soleDeciderStanding([], "2026-09-21")).toEqual({ standing: "none", decision: null });
  });

  it("reads a standing decision as licensing it", () => {
    const d = decision();
    expect(soleDeciderStanding([d], "2026-09-21")).toEqual({ standing: "good", decision: d });
  });

  it("ignores a decision about some other subject", () => {
    // The subject is the control, so a decision about a finding or a grant —
    // or about another control entirely — licenses nothing here.
    expect(soleDeciderStanding([decision({ subjectId: "some_other_control" })], "2026-09-21").standing).toBe("none");
    expect(soleDeciderStanding([decision({ subjectKind: "sod_finding" })], "2026-09-21").standing).toBe("none");
  });

  it("licenses only the kinds that say the practice chose to work in this state", () => {
    // Monitoring or intending to remediate records something about the
    // control and changes nothing about who may decide; a licence that any
    // decision granted would make the register a switch rather than a record.
    expect(licenses({ kind: "accept_residual" })).toBe(true);
    expect(licenses({ kind: "compensate" })).toBe(true);
    for (const kind of ["monitor", "remediate", "insure"] as const) {
      expect(licenses({ kind })).toBe(false);
      expect(soleDeciderStanding([decision({ kind })], "2026-09-21").standing).toBe("none");
    }
  });

  it("stops licensing once the decision is retired", () => {
    // `latestDecisionFor` reads a retired subject as undecided, so the second
    // pair of hands comes back by the register alone — nothing stored beside
    // the mappings has to be corrected for the control to tighten again.
    const retired = decision({ id: "d2", kind: "retire", reviewBy: undefined, decidedAt: "2026-09-22T09:00:00.000Z", supersedesDecisionId: "d1" });
    expect(soleDeciderStanding([decision(), retired], "2026-09-23").standing).toBe("none");
  });

  it("keeps licensing past an overdue review, and says that it is overdue", () => {
    // Increment 1.31's reading: a control that stood down is reported as
    // standing down with its review due, rather than switching back on under
    // a practice mid-month. A licence that expired by surprise would shut the
    // books on the day somebody was least ready for it.
    const late = soleDeciderStanding([decision({ reviewBy: "2026-09-01" })], "2026-09-21");
    expect(late.standing).toBe("overdue");
    expect(late.decision?.reviewBy).toBe("2026-09-01");
  });
});

describe("what the practice is told when nobody else can decide", () => {
  it("names the people who could, where there are some", () => {
    expect(soleDeciderRefusal(1)[0]).toContain("1 other administrator can");
    expect(soleDeciderRefusal(3)[0]).toContain("3 other administrators can");
  });

  it("names the act instead of a person, where there is nobody", () => {
    // The sentence this replaces — "a different person must approve or reject
    // it" — is true and useless to a practice that has no different person: it
    // names an act the reader cannot perform and implies a path that does not
    // exist.
    const said = soleDeciderRefusal(0).join(" ");
    expect(said).toContain("no other administrator");
    expect(said).toContain("accept-residual decision");
    expect(said).toContain("review date");
    expect(said).toContain("reported to your accountant");
    // And it does not send the reader looking for a screen that appoints one.
    expect(said).toContain("cannot yet appoint a second administrator");
    expect(soleDeciderRefusal(0).length).toBeGreaterThan(1);
  });
});

describe("what the accountant is told", () => {
  it("says nothing was decided alone, where nothing was", () => {
    expect(soleDeciderSentence(0, 4)).toContain("decided by somebody other than the person who proposed it");
    expect(soleDeciderSentence(0, 0)).toBe("No mapping is in force for this month.");
  });

  it("counts the mappings one pair of hands decided, and the ones that had two", () => {
    expect(soleDeciderSentence(1, 3)).toContain("1 of the 3 mappings in force was decided by the person who proposed it");
    expect(soleDeciderSentence(1, 3)).toContain("The remaining 2 had a second pair of hands");
    expect(soleDeciderSentence(3, 3)).toContain("3 of the 3 mappings in force were decided by the person who proposed them");
    expect(soleDeciderSentence(3, 3)).toContain("The remaining 0 had a second pair of hands");
  });

  it("names the decision behind it, so the count is not a bare accusation", () => {
    expect(soleDeciderSentence(2, 5)).toContain("under a recorded decision that this practice has one administrator");
  });
});
