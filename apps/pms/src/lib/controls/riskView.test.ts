import { describe, expect, it } from "vitest";
import type { ControlDecision } from "@pms/controls-engine";
import {
  centsPhrase,
  conflictDecisionState,
  decisionStateLabel,
  dutiesByPerson,
  grantRefusal,
  attestationSentence,
  lastCompleteMonth,
  provenanceSentence,
  reasonTighteningSentence,
  reasonTighteningsForChannel,
} from "./riskView";
import type { ReasonCodeRow } from "../ledger/reasons";

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

describe("reason thresholds beside the coverage they tighten", () => {
  function reason(over: Partial<ReasonCodeRow>): ReasonCodeRow {
    return {
      code: "courtesy",
      kind: "write_off",
      label: "Courtesy",
      active: true,
      reserved: false,
      requiresApprovalOverCents: null,
      entries: 0,
      ...over,
    };
  }

  const rows: ReasonCodeRow[] = [
    reason({ code: "courtesy", label: "Courtesy", requiresApprovalOverCents: 5_000 }),
    reason({ code: "contractual_ppo", label: "Contractual PPO", requiresApprovalOverCents: 0 }),
    // No figure: the channel's own governs, so it holds nothing to show.
    reason({ code: "prior_period", kind: "adjustment", label: "Prior period", reserved: true }),
    // Retired: it reaches no form, so it holds nothing either.
    reason({ code: "old_courtesy", label: "Old courtesy", active: false, requiresApprovalOverCents: 100 }),
    // Another channel's: a refund runs through check, not write-off.
    reason({ code: "overpayment", kind: "refund", label: "Overpayment", requiresApprovalOverCents: 2_500 }),
  ];

  it("names only the active codes carrying a figure on this channel, loosest first", () => {
    const found = reasonTighteningsForChannel({
      channel: "writeoff",
      channelThresholdUsd: 150,
      rows,
      decisions: [],
    });
    expect(found.map((t) => t.code)).toEqual(["courtesy", "contractual_ppo"]);
    expect(found[0]).toMatchObject({ cents: 5_000, effectiveCents: 5_000, redundant: false, decision: null });
    expect(found[1]).toMatchObject({ cents: 0, effectiveCents: 0, redundant: false });
  });

  it("puts a refund reason on the channel a refund runs through", () => {
    const found = reasonTighteningsForChannel({ channel: "check", channelThresholdUsd: 500, rows, decisions: [] });
    expect(found.map((t) => t.code)).toEqual(["overpayment"]);
    expect(found[0]?.effectiveCents).toBe(2_500);
  });

  it("says so where a reason's figure is not below the channel's, rather than implying it tightens", () => {
    const loose = [reason({ code: "courtesy", label: "Courtesy", requiresApprovalOverCents: 90_000 })];
    const [t] = reasonTighteningsForChannel({ channel: "writeoff", channelThresholdUsd: 150, rows: loose, decisions: [] });
    expect(t).toMatchObject({ cents: 90_000, effectiveCents: 15_000, redundant: true });
    expect(reasonTighteningSentence(t!)).toBe(
      "Courtesy: $900 — not below the channel, so it holds nothing extra today"
    );
  });

  it("names the decision standing on a reason the practice loosened", () => {
    const licensing = decision({
      id: "d-reason",
      subjectKind: "reason_code",
      subjectId: "courtesy",
      kind: "accept_residual",
      decidedByName: "Riley Owner",
      reviewBy: "2026-12-01",
    });
    const [t] = reasonTighteningsForChannel({
      channel: "writeoff",
      channelThresholdUsd: 150,
      rows: [reason({ requiresApprovalOverCents: 10_000 })],
      decisions: [licensing],
    });
    expect(t?.decision?.id).toBe("d-reason");
    expect(reasonTighteningSentence(t!)).toBe(
      "Courtesy: $100 · loosened under Accept residual by Riley Owner, review by 2026-12-01"
    );
  });

  it("names no decision once the practice has tightened back and the decision is retired", () => {
    // `latestDecisionFor` reads a retire as nothing standing, which is what
    // tightening back writes (Increment 1.47).
    const retired = decision({ id: "d-gone", subjectKind: "reason_code", subjectId: "courtesy", kind: "retire" });
    const [t] = reasonTighteningsForChannel({
      channel: "writeoff",
      channelThresholdUsd: 150,
      rows: [reason({ requiresApprovalOverCents: 10_000 })],
      decisions: [retired],
    });
    expect(t?.decision).toBeNull();
    expect(reasonTighteningSentence(t!)).toBe("Courtesy: $100");
  });

  it("writes cents the way the page writes money", () => {
    expect(centsPhrase(0)).toBe("every one");
    expect(centsPhrase(15_000)).toBe("$150");
    expect(centsPhrase(125_050)).toBe("$1,250.50");
  });
});

describe("what the coverage table says about a channel the product cannot enforce", () => {
  it("names the last month that has ended, not the one still filling", () => {
    expect(lastCompleteMonth("2026-09-18")).toBe("2026-08");
    // Across a year boundary, which a naive subtraction gets wrong.
    expect(lastCompleteMonth("2026-01-04")).toBe("2025-12");
    expect(lastCompleteMonth("2026-11-30")).toBe("2026-10");
  });

  it("says nobody has spoken rather than letting the word stand alone", () => {
    expect(attestationSentence(null, "2026-08")).toBe("Nobody has reviewed 2026-08.");
    expect(
      attestationSentence({ byName: "Casey Prentice", seat: "accountant", at: "2026-09-03T10:00:00.000Z" }, "2026-08")
    ).toBe("Reviewed for 2026-08 by Casey Prentice (the accountant) on 2026-09-03.");
    // An attestation the practice makes about its own external channel is
    // worth less than an independent reader's, so the row says which it is.
    expect(
      attestationSentence({ byName: "Riley Owner", seat: "practice", at: "2026-09-03T10:00:00.000Z" }, "2026-08")
    ).toBe("Reviewed for 2026-08 by Riley Owner (the practice itself) on 2026-09-03.");
  });
});
