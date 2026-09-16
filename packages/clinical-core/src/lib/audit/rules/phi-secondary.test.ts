import { describe, expect, it } from "vitest";
import { runPhiRule } from "./phi";
import { mergePhiScans, runPhiSecondary, scanPhiForProvider } from "./phi-secondary";

describe("phi secondary scan", () => {
  it("flags email addresses before provider calls", () => {
    const hits = runPhiSecondary("Send summary to jane.doe@clinic.example");
    expect(hits.some((h) => h.ruleId === "phi.email-address")).toBe(true);
  });

  it("flags MRN labels", () => {
    const hits = runPhiSecondary("MRN: AB123456 on the referral");
    expect(hits.some((h) => h.ruleId === "phi.mrn-label")).toBe(true);
  });

  it("never clears a primary finding when merging", () => {
    const primary = runPhiRule("SSN 123-45-6789").filter((f) => f.category === "phi");
    const secondary = runPhiSecondary("also email a@b.co");
    const merged = mergePhiScans(primary, secondary);
    expect(merged.some((h) => h.ruleId === "phi.ssn")).toBe(true);
    expect(merged.some((h) => h.ruleId === "phi.email-address")).toBe(true);
  });

  it("lets an injected model scanner only add blocks", () => {
    const primary = runPhiRule("clean clinical text with no identifiers").filter(
      (f) => f.category === "phi"
    );
    const merged = scanPhiForProvider("clean clinical text with no identifiers", primary, () => [
      {
        ruleId: "phi.model-extra",
        category: "phi",
        severity: "S0",
        message: "model-only add",
        matchedText: "clean"
      }
    ]);
    expect(merged.some((h) => h.ruleId === "phi.model-extra")).toBe(true);
  });

  it("leaves ordinary operatory notes alone", () => {
    const hits = runPhiSecondary(
      "Tooth 14 MOD composite. 2 carpules lidocaine 2%. Post-op instructions given."
    );
    expect(hits).toEqual([]);
  });
});
