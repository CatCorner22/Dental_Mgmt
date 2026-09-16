import { describe, expect, it } from "vitest";
import {
  AS_OF,
  ENFORCEMENT_INCREMENT_1_12,
  liveDecisions,
  liveGrants,
  livePeople,
  livePolicy,
} from "./fixtures/live-grants";
import type { ControlDecision } from "./decisions";
import { buildPracticeState } from "./practice-state-builder";
import { CONTROL_TEMPLATES, SCENARIO_TEMPLATES } from "./templates";

function build(overrides?: Partial<Parameters<typeof buildPracticeState>[0]>) {
  return buildPracticeState({
    people: livePeople,
    grants: liveGrants,
    policy: livePolicy(),
    decisions: [],
    enforcement: ENFORCEMENT_INCREMENT_1_12,
    asOf: AS_OF,
    ...overrides,
  });
}

describe("buildPracticeState", () => {
  it("assembles every input the scorers expect from live rows only", () => {
    const b = build();
    expect(b.state.people).toBe(livePeople);
    expect(b.state.scenarios).toBe(SCENARIO_TEMPLATES);
    expect(b.state.knowledge).toEqual([]);
    expect(b.state.controls.map((c) => c.id)).toEqual(CONTROL_TEMPLATES.map((t) => t.id));
    expect(b.unknownEntitlements).toEqual([{ personId: "u-hyg", entitlement: "view_schedule" }]);
    expect(b.coverage).toHaveLength(6);
  });

  it("derives staff composition instead of typing it in", () => {
    const b = build();
    expect(b.state.staff.teamSize).toBe(5); // inactive person excluded
    expect(b.state.staff.segregationScore).toBe(b.sod.summary.segregationHealth);
    expect(b.state.staff.dualControlPayments).toBe(true); // ACH enforced and enabled
    expect(b.state.staff.independentBankRec).toBe(false); // not measured yet
    expect(b.state.staff.soleOwnerKnowledgeCount).toBe(0); // no knowledge map yet
    expect(b.state.staff.avgTenureYears).toBe(6.2);
  });

  it("turns dual control off when no payment channel counts", () => {
    const b = build({
      enforcement: { ...ENFORCEMENT_INCREMENT_1_12, ach: "external", check: "external" },
    });
    expect(b.state.staff.dualControlPayments).toBe(false);
    expect(b.mitigatedRuleIds).toEqual(["rule-claims-writeoff", "rule-writeoff"]);
  });

  it("marks a control unsegregated when a live conflict touches its rules", () => {
    const b = build();
    const byId = Object.fromEntries(b.state.controls.map((c) => [c.id, c]));
    // Office manager holds create_vendor + release_payment.
    expect(byId["c-sod-ap"].segregated).toBe(false);
    // Front desk collects cash and posts payments.
    expect(byId["c-cash"].segregated).toBe(false);
    // Office manager prepares the deposit and posts payments (rule-deposit-post).
    expect(byId["c-sod-cash"].segregated).toBe(false);
    expect(b.sod.conflicts.some((c) => c.ruleId === "rule-deposit-post" && c.personId === "u-om")).toBe(true);
    expect(b.sod.conflicts.some((c) => c.ruleId === "rule-cash-rec")).toBe(false);
    // Payroll: owner approves, office manager enters — different people.
    expect(byId["c-payroll"].segregated).toBe(true);
    // Owner administers roles but does not post payments.
    expect(byId["c-pms-admin"].segregated).toBe(true);
    // Enforced ACH and check credit the vendor control as compensating.
    expect(byId["c-sod-ap"].compensatingControls.some((n) => n.startsWith("Dual release on ACH"))).toBe(true);
  });

  it("never credits an external channel as a compensating control", () => {
    const b = build();
    const payroll = b.state.controls.find((c) => c.id === "c-payroll")!;
    expect(payroll.compensatingControls).toEqual([]);
    const sodCash = b.state.controls.find((c) => c.id === "c-sod-cash")!;
    expect(sodCash.compensatingControls.some((n) => /deposit/i.test(n))).toBe(false);
  });

  it("reads residual acceptance and compensating notes from the decision register", () => {
    const withDecisions = build({ decisions: liveDecisions });
    const ap = withDecisions.state.controls.find((c) => c.id === "c-sod-ap")!;
    expect(ap.compensatingControls).toContain(liveDecisions[0].note);
    // dec-2 accepts residual on billing's write-off conflict, but billing also
    // carries rule-claims-writeoff without a decision: the control is not accepted.
    const billing = withDecisions.state.controls.find((c) => c.id === "c-sod-billing")!;
    expect(billing.residualRiskAccepted).toBe(false);

    const acceptAll: ControlDecision[] = withDecisions.sod.conflicts
      .filter((c) => ["rule-writeoff", "rule-claims-writeoff", "rule-admin-writeoff"].includes(c.ruleId))
      .map((c, i) => ({
        id: `acc-${i}`,
        subjectKind: "sod_finding",
        subjectId: c.id,
        kind: "accept_residual",
        note: "Owner signs the monthly adjustment exception report.",
        reviewBy: "2026-12-01",
        decidedById: "u-owner",
        decidedByName: "Dr. Reagan",
        decidedAt: "2026-09-01T00:00:00.000Z",
      }));
    const accepted = build({ decisions: acceptAll });
    expect(accepted.state.controls.find((c) => c.id === "c-sod-billing")!.residualRiskAccepted).toBe(true);
    expect(
      accepted.sod.conflicts.filter((c) => c.ruleId === "rule-writeoff").every((c) => c.residualRiskAccepted),
    ).toBe(true);
  });

  it("is deterministic for the same rows", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("does not emit Infinity or NaN anywhere", () => {
    const text = JSON.stringify(build());
    expect(text).not.toMatch(/Infinity|NaN|null,null/);
  });
});
