import { describe, expect, it } from "vitest";
import { runPhiRule } from "./phi";
import { buildMaskPlan, applyMaskPlan } from "@/lib/audit/maskPhi";
import { buildReport, computeGates, isValidPhiAttestation } from "@/lib/audit/engine";

// matchedText is not a display string. The Mask identifiers button replaces it
// by LITERAL SUBSTRING, so a rule whose match spans something other than the
// identifier masks the wrong text — and clears its own STOP while the
// identifier stays in the note. Every case below ended with the note reporting
// AUDIT PASS while still carrying a name.

const mask = (text: string) => {
  const findings = runPhiRule(text).filter((f) => f.matchedText);
  return applyMaskPlan(text, buildMaskPlan(findings as never));
};
const exportable = (text: string) => computeGates(buildReport(runPhiRule(text)), false).exportAllowed;
const matched = (text: string, ruleId: string) =>
  runPhiRule(text).filter((f) => f.ruleId === ruleId).map((f) => f.matchedText);

describe("masking removes the identifier, not the label around it", () => {
  it("captures the name after a name label", () => {
    // The rule matched "Patient name:" alone, so one click deleted the LABEL,
    // left the patient's name, and the re-audit called the result AUDIT PASS.
    expect(matched("Guardian name = Kwame Osei, contacted by phone.", "phi.name-label")).toEqual([
      "Kwame Osei"
    ]);
    const out = mask("Guardian name = Kwame Osei, contacted by phone.");
    expect(out).not.toContain("Kwame Osei");
    expect(out).toContain("Guardian name =");
  });

  it("still stops on a bare label with nothing after it", () => {
    expect(exportable("Patient name:")).toBe(false);
  });
});

describe("an honorific name is matched whole", () => {
  const cases: Array<[string, string]> = [
    ["Referred to Dr. McDonald for the consult.", "McDonald"],
    ["Referred to Dr. O'Brien for the consult.", "O'Brien"],
    ["Spoke with Mr. MacLeod about the plan.", "MacLeod"],
    ["Seen by Mr. Smith-Jones today.", "Smith-Jones"],
    ["Seen by DR. SMITH for the extraction.", "SMITH"],
    ["Mrs. NGUYEN presented for a recall.", "NGUYEN"]
  ];

  for (const [text, name] of cases) {
    it(`captures ${name}`, () => {
      // The old pattern was [A-Z][a-z]+, which stopped at an internal capital:
      // "Dr. McDonald" matched only "Dr. Mc", so masking left "…Donald" — a
      // recoverable surname — and cleared the S0. "Dr. O'Brien" and the ALL
      // CAPS forms matched nothing at all, even though the weaker S2 bare-name
      // rule below has always handled them.
      expect(matched(text, "phi.name")).toEqual([name]);
      expect(exportable(text), `${text} must stop`).toBe(false);
      const out = mask(text);
      expect(out, text).not.toContain(name);
      expect(exportable(out), `${text} must be clean after masking`).toBe(true);
    });
  }
});

describe("overlapping name matches do not cancel each other", () => {
  it("removes the whole name when two rules see different spans", () => {
    // "Mrs. Elizabeth" (S0) and "Elizabeth Ng" (S2) OVERLAP rather than nest,
    // so longest-first replacement erased the second one's anchor and left the
    // surname in a note that then audited clean. Short surnames — Ng, Ho, Li,
    // Wu, Cruz — made the failure land on specific patient populations.
    const text = "Mrs. Elizabeth Ng presented for a recall.";
    expect(exportable(text)).toBe(false);
    const out = mask(text);
    expect(out).not.toContain("Elizabeth");
    expect(out).not.toContain("Ng ");
  });
});

describe("record links are seen whatever punctuation separates them", () => {
  for (const text of [
    "MRN - 4471902.",
    "MRN = 4471902.",
    "MRN: 4471902.",
    "Chart 4471902.",
    "Patient ID 4471902."
  ]) {
    it(`stops on ${JSON.stringify(text)}`, () => {
      expect(exportable(text)).toBe(false);
    });
  }
});

describe("the screen does not rewrite the clinical record", () => {
  // The Mask button acts on S2 findings too, so a false positive here does not
  // merely cry wolf — one click rewrites the anaesthesia and radiograph record
  // of a legal document, and the re-audit reports AUDIT PASS on the result.
  for (const text of [
    "Full Mouth X-Ray Series obtained.",
    "PANORAMIC X-RAY TAKEN.",
    "IAN BLOCK ADMINISTERED, 2 CARPULES.",
    "MAX LEFT QUADRANT SCALED.",
    "Grace Period expired on the account."
  ]) {
    it(`leaves ${JSON.stringify(text)} untouched`, () => {
      expect(runPhiRule(text).filter((f) => f.ruleId.startsWith("phi.name"))).toEqual([]);
      expect(mask(text)).toBe(text);
    });
  }
});

describe("an attestation must contain text a human can read", () => {
  // A DENYLIST of invisible characters is unwinnable. The old one did not know
  // about BRAILLE PATTERN BLANK, the HANGUL FILLERs, variation selectors or
  // tag characters, and a reason built from those scored 23 chars / 4 words /
  // 5 distinct while rendering as empty space on the frozen legal record.
  const blankPayloads: Array<[string, string]> = [
    ["braille + hangul fillers", "⠀ㅤᅟᅠﾠ ".repeat(4)],
    ["variation selectors", "︀︁︂︃︄ ".repeat(4)],
    ["combining marks", "̀́̂̃̄ ".repeat(4)],
    ["zero width", "​‌‍⁠﻿ ".repeat(4)]
  ];

  for (const [label, payload] of blankPayloads) {
    it(`refuses ${label}`, () => {
      expect(isValidPhiAttestation(payload)).toBe(false);
    });
  }

  it("refuses one word repeated four times", () => {
    expect(isValidPhiAttestation("asdfg asdfg asdfg asdfg")).toBe(false);
  });

  it("accepts a reason that states what the flagged text is", () => {
    expect(isValidPhiAttestation("These are tooth numbers, not a calendar date.")).toBe(true);
    expect(isValidPhiAttestation("This is the implant lot number from the sticker.")).toBe(true);
  });
});
