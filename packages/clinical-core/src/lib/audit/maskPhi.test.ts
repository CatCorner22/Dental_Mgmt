import { describe, expect, it } from "vitest";
import { applyMaskPlan, buildMaskPlan, MASK_TOKEN_PATTERN, maskKindFor } from "./maskPhi";
import { runPhiRule } from "./rules/phi";
import { runTextAudit } from "./engine";

// The screen already says "this looks like an identifier." Before masking, the
// only ways forward were retype it by hand or waive the stop — and under time
// pressure between patients the waiver is the path of least resistance, which
// is a bad default for the one gate the PII-free premise rests on.

const planFor = (text: string) => buildMaskPlan(runPhiRule(text));
const mask = (text: string) => applyMaskPlan(text, planFor(text));

describe("a mask carries nothing of the original", () => {
  it("is random, not derived — the same identifier masks differently each time", () => {
    // The property that makes this pseudonymization rather than a reversible
    // code. A hash or cipher of the identifier still CONTAINS the identifier
    // to anyone holding the function; random bytes have no relationship to it.
    const runs = new Set(Array.from({ length: 25 }, () => mask("SSN 123-45-6789 on file.")));
    expect(runs.size).toBeGreaterThan(20);
  });

  it("never leaves the original text behind", () => {
    const out = mask("Call 865-555-1234 or email jane.doe@example.com about it.");
    expect(out).not.toContain("865-555-1234");
    expect(out).not.toContain("jane.doe@example.com");
  });

  it("produces a token a human reads as redacted", () => {
    expect(mask("SSN 123-45-6789 on file.")).toMatch(/\[ID-[A-Z2-9]{4}\]/);
  });
});

describe("a masked note still makes sense", () => {
  it("gives the same identifier the same token throughout one note", () => {
    // Otherwise a reader cannot tell whether two masked mentions are one
    // person or two, and the note stops being a clinical record.
    const out = mask("Call 865-555-1234. If no answer, try 865-555-1234 again.");
    const tokens = out.match(MASK_TOKEN_PATTERN) ?? [];
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toBe(tokens[1]);
  });

  it("gives different identifiers different tokens", () => {
    const out = mask("Home 865-555-1234, mobile 865-555-9876.");
    const tokens = new Set(out.match(MASK_TOKEN_PATTERN) ?? []);
    expect(tokens.size).toBe(2);
  });

  it("preserves what KIND of fact was there", () => {
    expect(maskKindFor("phi.name-bare")).toBe("PERSON");
    expect(maskKindFor("phi.phone")).toBe("CONTACT");
    expect(maskKindFor("phi.email")).toBe("CONTACT");
    expect(maskKindFor("phi.date-iso")).toBe("DATE");
    expect(maskKindFor("phi.ssn")).toBe("ID");
    expect(maskKindFor("phi.mrn")).toBe("ID");
    // A masked phone must not read as a person, or the note loses its meaning
    // along with its identifier.
    expect(mask("Reached at 865-555-1234.")).toContain("[CONTACT-");
  });

  it("leaves the surrounding clinical text untouched", () => {
    const out = mask("Prophylaxis completed. Call 865-555-1234. Recall six months.");
    expect(out).toContain("Prophylaxis completed.");
    expect(out).toContain("Recall six months.");
  });
});

describe("the plan is safe to apply", () => {
  it("replaces the longest match first, so no fragment survives", () => {
    // If a short match is a substring of a longer one, replacing the short one
    // first corrupts the long one and leaves part of the identifier behind.
    const plan = buildMaskPlan([
      { ruleId: "phi.phone", category: "phi", severity: "S0", message: "", matchedText: "555-1234" },
      { ruleId: "phi.phone", category: "phi", severity: "S0", message: "", matchedText: "865-555-1234" }
    ]);
    expect(plan[0].matchedText).toBe("865-555-1234");
    const out = applyMaskPlan("Call 865-555-1234 now.", plan);
    expect(out).not.toContain("555-1234");
    expect(out).not.toContain("865-");
  });

  it("does not re-mask a token from an earlier pass", () => {
    const already = "Reached at [CONTACT-A7K2].";
    expect(buildMaskPlan(runPhiRule(already))).toEqual([]);
    expect(mask(already)).toBe(already);
  });

  it("is a no-op on a note with nothing to mask", () => {
    const clean = "Prophylaxis completed. Oral hygiene instruction given.";
    expect(planFor(clean)).toEqual([]);
    expect(mask(clean)).toBe(clean);
  });

  it("treats the matched text literally, never as a regex", () => {
    // A plan built from user text must not be able to inject a pattern.
    const plan = buildMaskPlan([
      { ruleId: "phi.mrn", category: "phi", severity: "S0", message: "", matchedText: "a.*b" }
    ]);
    const out = applyMaskPlan("keep a.*b and axxb", plan);
    expect(out).toContain("axxb");
    expect(out).not.toContain("a.*b");
  });

  it("uses an alphabet with no lookalike characters", () => {
    // A token read aloud across an operatory, or copied by hand, must not come
    // back as a different token.
    const tokens = Array.from({ length: 60 }, () => mask("SSN 123-45-6789.")).join(" ");
    expect(tokens).not.toMatch(/\[ID-[A-Z2-9]*[OIL01S5]/);
  });
});

describe("masking actually clears the stop", () => {
  it("a masked note no longer trips the screen it was masked for", () => {
    const before = "SSN 123-45-6789, phone 865-555-1234, seen 03/14/2026.";
    const after = mask(before);
    const stops = runPhiRule(after).filter((f) => f.severity === "S0");
    expect(stops).toEqual([]);
  });
});

describe("a masked note is actually fileable", () => {
  it("mask tokens are not treated as unresolved template residue", () => {
    // The defect the live probe caught and the unit tests missed, because they
    // only exercised runPhiRule. `[PERSON-A7K2]` matched residue.square-brackets
    // at S1, and S1 blocks email — so choosing the safe option made the note
    // unfileable and pushed the clinician back to waiving the privacy stop,
    // which is exactly what masking exists to replace.
    const masked = "Reached [CONTACT-A7K2] about the estimate; [PERSON-B4M9] agreed to proceed.";
    expect(runTextAudit(masked)).toEqual([]);
  });

  it("still flags a real unfilled placeholder", () => {
    const residue = runTextAudit("Reached [patient phone] about the estimate.");
    expect(residue.map((f) => f.ruleId)).toContain("residue.square-brackets");
  });

  it("masking a flagged note clears every blocking finding", () => {
    const before = "Call 865-555-1234 or email jane.doe@example.com about it.";
    const after = mask(before);
    const blocking = runTextAudit(after).filter((f) => f.severity === "S0" || f.severity === "S1");
    expect(blocking).toEqual([]);
  });
});

describe("overlapping and partial-word matches cannot leave an identifier behind", () => {
  // Both of these shipped, and both ended the same way: an identifier still in
  // the note while the re-audit reported AUDIT PASS and re-opened export.
  const maskAll = (text: string) => {
    const findings = runPhiRule(text).filter((f) => f.category === "phi" && f.matchedText);
    return applyMaskPlan(text, buildMaskPlan(findings));
  };

  it("masks BOTH names when a spurious cross-name match overlaps them", () => {
    // "John Smith, Mary Jones" also yields "Smith, Mary" across the comma.
    // Replacing longest-first destroyed the other two anchors, leaving
    // "John [PERSON-x] Jones" — both real names half-masked.
    const out = maskAll("Consultation. John Smith, Mary Jones attended.");
    expect(out).not.toContain("John");
    expect(out).not.toContain("Smith");
    expect(out).not.toContain("Mary");
    expect(out).not.toContain("Jones");
    expect(runPhiRule(out).filter((f) => f.ruleId.startsWith("phi.name"))).toEqual([]);
  });

  it("masks both people when they share a surname", () => {
    const out = maskAll("Present: Grace Miller, Karen Miller (guardian).");
    expect(out).not.toContain("Grace");
    expect(out).not.toContain("Karen");
    expect(out).not.toContain("Miller");
  });

  it("does not replace inside another word", () => {
    // "Ray" must not rewrite "X-Ray": the radiograph is not a person, and the
    // same person picking up two tokens breaks the one-token-per-identifier
    // property the mask design documents.
    const out = maskAll("Dr. Ray reviewed the X-Ray taken at the recall visit.");
    expect(out).toContain("X-Ray");
  });

  it("is idempotent — masking a masked note changes nothing further", () => {
    const once = maskAll("Seen by John Smith. Call 865-555-1234.");
    const twice = maskAll(once);
    expect(twice).toBe(once);
  });

  it("leaves text with no findings untouched", () => {
    const clean = "Prophylaxis completed. Oral hygiene instruction given.";
    expect(maskAll(clean)).toBe(clean);
  });
});
