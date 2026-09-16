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
    expect(b.state.staff.dualControlPayments).toBe(false); // ACH partial, deposit external
    expect(b.state.staff.independentBankRec).toBe(false); // not measured yet
    expect(b.state.staff.soleOwnerKnowledgeCount).toBe(0); // no knowledge map yet
    expect(b.state.staff.avgTenureYears).toBe(6.2);
  });

  it("turns dual control on only when a payment channel is fully covered", () => {
    expect(build().mitigatedRuleIds).toEqual(["rule-claims-writeoff", "rule-writeoff"]);
    const b = build({ enforcement: { ...ENFORCEMENT_INCREMENT_1_12, ach: "enforced" } });
    expect(b.state.staff.dualControlPayments).toBe(true);
    expect(b.mitigatedRuleIds).toContain("rule-vendor-create-pay");
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
    // Enforced write-off dual release credits the billing control as compensating.
    expect(byId["c-sod-billing"].compensatingControls.some((n) => n.startsWith("Dual release on Write-offs"))).toBe(
      true,
    );
  });

  it("never credits a partial or external channel as a compensating control", () => {
    const b = build();
    const payroll = b.state.controls.find((c) => c.id === "c-payroll")!;
    expect(payroll.compensatingControls).toEqual([]);
    const sodCash = b.state.controls.find((c) => c.id === "c-sod-cash")!;
    expect(sodCash.compensatingControls.some((n) => /deposit/i.test(n))).toBe(false);
    // Patient refunds and transfers run through check and ACH, but vendor
    // payments are not held: the vendor control earns no credit.
    const ap = b.state.controls.find((c) => c.id === "c-sod-ap")!;
    expect(ap.compensatingControls).toEqual([]);
    expect(b.sod.conflicts.find((c) => c.ruleId === "rule-vendor-create-pay")?.dualReleaseMitigated).toBe(false);
  });

  it("reads residual acceptance and compensating notes from the decision register", () => {
    const withDecisions = build({ decisions: liveDecisions });
    // dec-1 compensates one person's finding; it must not fan out to the control.
    const ap = withDecisions.state.controls.find((c) => c.id === "c-sod-ap")!;
    expect(ap.compensatingControls).not.toContain(liveDecisions[0].note);
    // A decision whose subject is the control does feed the control.
    const controlNote = "Owner signs every new vendor and reviews the ACH batch list monthly.";
    const withControlDecision = build({
      decisions: [
        {
          id: "dec-c",
          subjectKind: "control",
          subjectId: "c-sod-ap",
          kind: "compensate",
          note: controlNote,
          reviewBy: "2026-12-01",
          decidedById: "u-owner",
          decidedByName: "Dr. Reagan",
          decidedAt: "2026-09-02T00:00:00.000Z",
        },
      ],
    });
    expect(withControlDecision.state.controls.find((c) => c.id === "c-sod-ap")!.compensatingControls).toContain(
      controlNote,
    );
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

  it("keeps one person's decision from re-scoring another person's conflict", () => {
    // Jordan also prepares the deposit, so two people share rule-deposit-post.
    const grants = [
      ...liveGrants,
      {
        personId: "u-front",
        personName: "Jordan Blake",
        role: "Front Desk Lead",
        entitlement: "prepare_deposit",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
      },
    ];
    const none = build({ grants });
    const jordanBefore = none.sod.conflicts.find((c) => c.id === "u-front:rule-deposit-post")!;
    const compensateMaya: ControlDecision = {
      id: "dec-m",
      subjectKind: "sod_finding",
      subjectId: "u-om:rule-deposit-post",
      kind: "compensate",
      note: "Owner reviews Maya's deposit log every week.",
      reviewBy: "2026-12-01",
      decidedById: "u-owner",
      decidedByName: "Dr. Reagan",
      decidedAt: "2026-09-02T00:00:00.000Z",
    };
    const some = build({ grants, decisions: [compensateMaya] });
    const jordanAfter = some.sod.conflicts.find((c) => c.id === "u-front:rule-deposit-post")!;
    expect(jordanAfter.score).toBe(jordanBefore.score);
    expect(jordanAfter.compensatingControls).toEqual(jordanBefore.compensatingControls);
    expect(some.state.controls.find((c) => c.id === "c-sod-cash")!.compensatingControls).toEqual([]);
  });

  it("is deterministic for the same rows", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("does not emit Infinity or NaN anywhere", () => {
    const text = JSON.stringify(build());
    expect(text).not.toMatch(/Infinity|NaN|null,null/);
  });
});
