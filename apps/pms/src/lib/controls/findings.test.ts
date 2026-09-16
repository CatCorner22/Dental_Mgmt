import { describe, expect, it } from "vitest";
import type { DetectedConflict } from "@pms/controls-engine";
import { planFindingsRefresh, type FindingRow } from "./findings";

const now = new Date("2026-09-16T12:00:00Z");

function conflict(personId: string, ruleId: string, score = 80): DetectedConflict {
  return {
    id: `${personId}:${ruleId}`,
    ruleId,
    personId,
    personName: personId,
    role: "Office Manager",
    entitlementA: "post_payments",
    entitlementB: "bank_reconcile",
    labelA: "a",
    labelB: "b",
    severity: "critical",
    title: "t",
    why: "w",
    fraudPath: "f",
    score,
    compensatingControls: [],
    residualRiskAccepted: false,
    dualReleaseMitigated: false,
    processIds: [],
  };
}

function row(personId: string, ruleId: string, status: "open" | "closed", reopenedCount = 0): FindingRow {
  return {
    id: `f-${personId}-${ruleId}`,
    tenantId: "t1",
    ruleId,
    personId,
    entitlementA: "post_payments",
    entitlementB: "bank_reconcile",
    severity: "critical",
    score: 70,
    status,
    dualReleaseMitigated: false,
    residualRiskAccepted: false,
    linkedControlId: null,
    conflict: {},
    rulebookVersion: "0.1.0",
    firstSeenAt: now,
    lastSeenAt: now,
    closedAt: status === "closed" ? now : null,
    reopenedCount,
  };
}

describe("planFindingsRefresh", () => {
  it("inserts new conflicts, refreshes open ones, reopens closed ones, and closes the rest", () => {
    const existing = [row("p1", "rule-cash-rec", "open"), row("p2", "rule-writeoff", "closed", 1), row("p3", "rule-payroll", "open")];
    const conflicts = [conflict("p1", "rule-cash-rec", 90), conflict("p2", "rule-writeoff"), conflict("p4", "rule-vendor-create-pay")];
    const plan = planFindingsRefresh(existing, conflicts);
    expect(plan.inserts.map((c) => c.id)).toEqual(["p4:rule-vendor-create-pay"]);
    expect(plan.refresh.map((r) => r.row.id)).toEqual(["f-p1-rule-cash-rec"]);
    expect(plan.refresh[0].conflict.score).toBe(90);
    expect(plan.reopens.map((r) => r.row.id)).toEqual(["f-p2-rule-writeoff"]);
    expect(plan.closes.map((r) => r.id)).toEqual(["f-p3-rule-payroll"]);
  });

  it("never deletes and never closes a row that is already closed", () => {
    const existing = [row("p1", "rule-cash-rec", "closed")];
    const plan = planFindingsRefresh(existing, []);
    expect(plan).toEqual({ inserts: [], refresh: [], reopens: [], closes: [] });
  });

  it("keys on rule and person, so two family conflicts with one rule id collapse to one row", () => {
    const a = conflict("p1", "family-custody-recording");
    const b = { ...conflict("p1", "family-custody-recording"), id: "p1:family:collect_cash:submit_claims" };
    const plan = planFindingsRefresh([], [a, b]);
    expect(plan.inserts).toHaveLength(1);
  });
});
