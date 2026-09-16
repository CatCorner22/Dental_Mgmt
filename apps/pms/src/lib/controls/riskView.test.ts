import { describe, expect, it } from "vitest";
import type { ControlDecision } from "@pms/controls-engine";
import {
  conflictDecisionState,
  decisionStateLabel,
  dutiesByPerson,
  grantRefusal,
  provenanceSentence,
} from "./riskView";

const conflict = { id: "u-om:rule-custody-rec", ruleId: "rule-custody-rec" };

function decision(over: Partial<ControlDecision>): ControlDecision {
  return {
    id: "d1",
    subjectKind: "sod_finding",
    subjectId: conflict.id,
    kind: "accept_residual",
    note: "Owner reconciles the bank personally every Friday.",
    decidedById: "u-owner",
    decidedByName: "Riley Owner",
    decidedAt: "2026-09-01T12:00:00Z",
    ...over,
  };
}

describe("conflictDecisionState", () => {
  it("is open when no decision governs the conflict", () => {
    expect(conflictDecisionState(conflict, [], "2026-09-16")).toEqual({ state: "open" });
    expect(decisionStateLabel({ state: "open" })).toBe("No decision yet");
  });

  it("is decided while the review date is ahead, overdue once it has passed", () => {
    const d = decision({ reviewBy: "2026-12-31" });
    expect(conflictDecisionState(conflict, [d], "2026-09-16")).toEqual({ state: "decided", decision: d });
    expect(decisionStateLabel({ state: "decided", decision: d })).toBe("Accept residual · review by 2026-12-31");
    expect(conflictDecisionState(conflict, [d], "2027-01-01")).toEqual({ state: "overdue", decision: d });
    expect(decisionStateLabel({ state: "overdue", decision: d })).toMatch(/review was due 2026-12-31/);
  });

  it("lets a control-wide decision govern a conflict of that control", () => {
    const d = decision({ subjectKind: "control", subjectId: "c-cash", kind: "monitor" });
    expect(conflictDecisionState(conflict, [d], "2026-09-16")).toEqual({ state: "decided", decision: d });
    expect(decisionStateLabel({ state: "decided", decision: d })).toBe("Monitor");
  });
});

describe("grantRefusal", () => {
  it("names the refusal, keeps the next steps, and offers licensing only for a critical conflict", () => {
    const r = grantRefusal(
      {
        error: "Granting bank_reconcile to Maya Chen would create 1 critical conflict: Cash custody + bank reconciliation.",
        code: "sod_critical_conflict",
        nextSteps: ["Record a control decision (accept residual or compensate) with a review date in the same request."],
        conflicts: [{ id: "x", title: "Cash custody + bank reconciliation", personName: "Maya Chen", severity: "critical" }],
      },
      403
    );
    expect(r.verb).toBe("Needs a control decision before this grant");
    expect(r.canLicense).toBe(true);
    expect(r.conflicts[0]?.severity).toBe("Critical");
    expect(r.nextSteps).toHaveLength(1);
  });

  it("never offers licensing for a self-grant or an invalid decision", () => {
    expect(grantRefusal({ code: "self_grant_requires_second_admin", error: "x" }, 403)).toMatchObject({
      verb: "Needs a different administrator",
      canLicense: false,
    });
    expect(grantRefusal({ code: "decision_invalid", error: "x" }, 400).canLicense).toBe(false);
    expect(grantRefusal({ error: "That staff member is not in this practice." }, 404).verb).toBe("Not in this practice");
  });
});

describe("provenanceSentence", () => {
  it("says frozen or live, and always says directional", () => {
    const frozen = provenanceSentence({
      source: "stored",
      takenAt: "2026-09-16T02:00:00Z",
      trigger: "nightly",
      scoringVersion: "precog-residual-v1.1.0",
      rulebookVersion: "0.1.0",
    });
    expect(frozen).toMatch(/^Frozen .* \(nightly\)\. Scoring precog-residual-v1\.1\.0, rulebook 0\.1\.0\. Directional/);
    const live = provenanceSentence({
      source: "live",
      takenAt: "2026-09-16T02:00:00Z",
      trigger: "live",
      scoringVersion: "v",
      rulebookVersion: "r",
    });
    expect(live).toMatch(/^Computed from live rows just now, not frozen\./);
  });
});

describe("dutiesByPerson", () => {
  it("sorts by name and leaves the rows intact", () => {
    const rows = dutiesByPerson([
      { personId: "2", personName: "Zed", role: "Owner / Dentist", entitlements: ["bank_reconcile"] },
      { personId: "1", personName: "Amy", role: "Front Desk Lead", entitlements: [] },
    ]);
    expect(rows.map((r) => r.personName)).toEqual(["Amy", "Zed"]);
    expect(rows[1]?.entitlements).toEqual(["bank_reconcile"]);
  });
});
