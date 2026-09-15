import { describe, expect, it } from "vitest";
import { ridgeviewPractice } from "../fixtures/ridgeview";
import { buildAssignments, detectSodConflicts, ROLE_TEMPLATES } from "./detect";

describe("detectSodConflicts", () => {
  it("finds vendor create+pay on the office-manager template", () => {
    expect(ROLE_TEMPLATES["Office Manager"]).toContain("create_vendor");
    expect(ROLE_TEMPLATES["Office Manager"]).toContain("release_payment");

    const state = ridgeviewPractice();
    const report = detectSodConflicts(state);
    const omConflicts = report.conflicts.filter((c) => c.role === "Office Manager");
    expect(
      omConflicts.some(
        (c) =>
          c.ruleId === "rule-vendor-create-pay" ||
          (c.entitlementA === "create_vendor" && c.entitlementB === "release_payment") ||
          (c.entitlementA === "release_payment" && c.entitlementB === "create_vendor"),
      ),
    ).toBe(true);
  });

  it("finds post_payments + bank_reconcile when those entitlements are assigned", () => {
    const state = ridgeviewPractice();
    const assignments = buildAssignments(state.people, {
      p2: ["bank_reconcile"],
    });
    const report = detectSodConflicts(state, { assignments });
    expect(
      report.conflicts.some(
        (c) =>
          c.personId === "p2" &&
          (c.ruleId === "rule-cash-rec" ||
            ([c.entitlementA, c.entitlementB].includes("post_payments") &&
              [c.entitlementA, c.entitlementB].includes("bank_reconcile"))),
      ),
    ).toBe(true);
  });
});
