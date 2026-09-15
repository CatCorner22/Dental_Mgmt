import { describe, expect, it } from "vitest";
import { NON_ASCII_DIGIT, foldDigits } from "./foldDigits";
import { standardize } from "@/lib/standardize/standardize";
import { runPhiRule } from "@/lib/audit/rules/phi";

describe("foldDigits preserves the number and changes only the script", () => {
  it("leaves ASCII alone", () => {
    // An earlier version returned "0" the moment it saw the character "0" while
    // walking back to a block zero, rewriting "19" to "00" and "3" to "0". Input
    // and output were corrupted identically everywhere it was used, so every
    // comparison downstream still agreed and only the numbers shown to a human
    // were fiction.
    expect(foldDigits("Probing depths 3, 4, and 19 mm on tooth 30.")).toBe(
      "Probing depths 3, 4, and 19 mm on tooth 30."
    );
    expect(foldDigits("0")).toBe("0");
    expect(foldDigits("1024")).toBe("1024");
  });

  it("folds every decimal script without naming one", () => {
    expect(foldDigits("\u0665\u0660\u0660")).toBe("500"); // Arabic-Indic
    expect(foldDigits("\u096F\u096F\u096F")).toBe("999"); // Devanagari
    expect(foldDigits("\u0E55\u0E55")).toBe("55"); // Thai
    expect(foldDigits("\uFF15\uFF10\uFF10")).toBe("500"); // fullwidth
    expect(foldDigits("\u09E9")).toBe("3"); // Bengali
  });
});

describe("the detection pattern is linear, not quadratic", () => {
  it("is silent on a long run of ASCII digits, quickly", () => {
    // The regression guard for the shape of pattern this replaced. The natural
    // `\p{Nd}*(?![0-9])\p{Nd}\p{Nd}*` took 6.5 seconds on this input, inside a
    // rule that runs on every keystroke. performance.test.ts now covers the same
    // ground through runTextAudit; this is the direct measurement.
    const run = "1".repeat(60_000);
    const start = performance.now();
    expect(run.match(NON_ASCII_DIGIT)).toBeNull();
    expect(performance.now() - start).toBeLessThan(100);
  });

  it("still finds a foreign digit at the very end of a long run", () => {
    // Anchoring at the non-ASCII digit is what makes it linear; this proves the
    // anchoring did not cost the detection.
    expect(("1".repeat(60_000) + "\u0665").match(NON_ASCII_DIGIT)).toEqual(["\u0665"]);
  });
});

describe("the screen's advice is true", () => {
  // The finding tells the writer to press Standardize. Before the standardizer
  // folded digits, that named a remedy which did nothing — the worst kind of
  // error message, because the writer does as told and the stop does not clear.
  it("flags a number written in another script", () => {
    const ids = runPhiRule("Call \u0668\u0666\u0665-\u0665\u0665\u0665-\u0661\u0662\u0663\u0664.").map(
      (f) => f.ruleId
    );
    expect(ids).toContain("phi.obfuscated-digits");
  });

  it("and Standardize actually clears it", () => {
    const out = standardize("Call \u0668\u0666\u0665-\u0665\u0665\u0665-\u0661\u0662\u0663\u0664.");
    expect(out.text).toContain("865-555-1234");
    expect(runPhiRule(out.text).map((f) => f.ruleId)).not.toContain("phi.obfuscated-digits");
    // And the real identifier underneath is now visible to the screen that was
    // built to catch it, which is the entire point of folding rather than hiding.
    expect(runPhiRule(out.text).map((f) => f.ruleId)).toContain("phi.phone");
  });

  it("preserves a clinical number through the fold", () => {
    const out = standardize("Midazolam \u0665 mg IV.");
    expect(out.text).toContain("5 mg");
  });
});
