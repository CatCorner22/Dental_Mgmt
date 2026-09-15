import { describe, expect, it } from "vitest";
import { isValidPhiAttestation } from "@/lib/audit/engine";
import {
  composeFindingAttestation,
  composePhiOverrideReason,
  displayReasonCode,
  FINDING_ATTEST_CODES,
  isValidFindingAttestSelection,
  isValidPhiOverrideSelection,
  parseReasonCode,
  PHI_OVERRIDE_CODES
} from "./reasonCodes";

describe("finding attest reason codes — storm", () => {
  it("every template alone clears the substance bar", () => {
    for (const opt of FINDING_ATTEST_CODES) {
      const reason = composeFindingAttestation(opt.code);
      expect(isValidPhiAttestation(reason), opt.code).toBe(true);
      expect(isValidFindingAttestSelection(opt.code, "")).toBe(true);
    }
  });

  it("refuses an empty code", () => {
    expect(isValidFindingAttestSelection("", "plenty of words here for the bar")).toBe(false);
  });

  it("does not treat rule-disagreement as an attest code", () => {
    expect(
      FINDING_ATTEST_CODES.some((c) => c.code === ("rule-disagreement" as never))
    ).toBe(false);
  });

  it("parses the stored prefix stably across casing", () => {
    const stored = composeFindingAttestation("patient-quote", "She said it hurt.");
    const parsed = parseReasonCode(stored);
    expect(parsed.code).toBe("patient-quote");
    expect(parsed.prose.toLowerCase()).toContain("hurt");
  });

  it("display collapses template-only to the label", () => {
    const stored = composeFindingAttestation("correct-as-written");
    expect(displayReasonCode(stored)).toBe("Correct as written");
  });
});

describe("PHI override reason codes — storm", () => {
  it("every template alone clears the substance bar and the selection gate", () => {
    for (const opt of PHI_OVERRIDE_CODES) {
      const reason = composePhiOverrideReason(opt.code);
      expect(isValidPhiAttestation(reason), opt.code).toBe(true);
      expect(isValidPhiOverrideSelection(opt.code, "", true), opt.code).toBe(true);
    }
  });

  it("requires the review checkbox", () => {
    expect(isValidPhiOverrideSelection("clinical-value", "", false)).toBe(false);
  });

  it("appends optional prose after the template", () => {
    const reason = composePhiOverrideReason(
      "tooth-or-site-numbers",
      "ADA Universal tooth 19 and 20."
    );
    expect(reason).toMatch(/^\[tooth-or-site-numbers\]/);
    expect(reason.toLowerCase()).toContain("tooth 19");
    expect(isValidPhiAttestation(reason)).toBe(true);
  });

  it("is idempotent compose → parse ×3", () => {
    const once = composePhiOverrideReason("device-lot-or-serial", "Implant lot on the tray.");
    expect(parseReasonCode(once).code).toBe("device-lot-or-serial");
    expect(parseReasonCode(once).code).toBe("device-lot-or-serial");
    expect(parseReasonCode(once).code).toBe("device-lot-or-serial");
  });
});
