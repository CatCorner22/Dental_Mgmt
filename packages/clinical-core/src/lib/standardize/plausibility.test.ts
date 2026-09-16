import { describe, expect, it } from "vitest";
import { findImplausibleQuantities } from "./plausibility";
import { standardize } from "./standardize";

const reasons = (s: string) => findImplausibleQuantities(s).map((q) => q.reason).join(" ");

describe("units that are never right in a dental note", () => {
  it.each([
    "Prescribed 1 ton of amoxicillin.",
    "Irrigated with 5 gallons of saline.",
    "Used 2 quarts of solution.",
    "Administered 3 pints.",
    "Ordered 1 tonne of alginate."
  ])("catches %j", (input) => {
    const found = findImplausibleQuantities(input);
    expect(found.length, input).toBeGreaterThan(0);
  });

  it("never proposes a corrected value", () => {
    // The hard boundary: this tool does not suggest doses. If it ever starts
    // saying "did you mean 500 mg" it has become clinical decision support.
    const r = reasons("Prescribed 1 ton of amoxicillin.");
    expect(r).toContain("will not guess");
    expect(r).not.toMatch(/did you mean|try \d|should be \d/i);
  });
});

describe("legitimate units at impossible magnitudes", () => {
  it.each([
    ["Prescribed 50000 mg.", "mg"],
    ["Gave 500 g of drug.", "g"],
    ["Irrigated with 9000 mL.", "mL"],
    ["Probing depth 900 mm.", "mm"],
    ["Lesion 90 cm across.", "cm"],
    ["Used 60 carpules.", "carpules"],
    ["Patient weighs 900 kg.", "kg"]
  ])("catches %j", (input) => {
    expect(findImplausibleQuantities(input).length, input).toBeGreaterThan(0);
  });

  it("flags an impossible percentage", () => {
    expect(findImplausibleQuantities("Used 250% lidocaine.").length).toBe(1);
    expect(reasons("Used 250% lidocaine.")).toContain("cannot exceed 100");
  });
});

// The bounds are deliberately far outside anything real. A checker that fires
// on ordinary values gets ignored, which costs more safety than it buys.
describe("ordinary clinical values are NOT flagged", () => {
  it.each([
    "Prescribed amoxicillin 500 mg three times daily.",
    "Ibuprofen 600 mg as needed.",
    "Probing depths 3, 4, and 5 mm.",
    "Irrigated with 20 mL of saline.",
    "Used 2 carpules of lidocaine.",
    "Lidocaine 2% with epinephrine.",
    "Patient weighs 72 kg.",
    "Patient weighs 165 lb.",
    "Lesion 8 mm across.",
    "Recall in 6 months.",
    "Restored tooth 19 and tooth 30.",
    "Blood pressure 128 over 82.",
    "Procedure took 45 minutes.",
    "Acquired 4 radiographs."
  ])("leaves %j alone", (input) => {
    expect(findImplausibleQuantities(input), input).toEqual([]);
  });
});

describe("integration with the transformer", () => {
  it("surfaces an implausible quantity as a flag, and does not change the text", () => {
    const r = standardize("Prescribed 1 ton of amoxicillin.");
    // The number is untouched — only the clinician may fix it.
    expect(r.text).toContain("1 ton");
    const flag = r.flags.find((f) => f.kind === "implausible-quantity");
    expect(flag).toBeDefined();
    expect(flag!.display).toBe("1 ton");
  });

  it("still catches it after unit spacing is normalized", () => {
    // "50000mg" becomes "50000 mg" earlier in the pipeline; the check runs on
    // the final text so it sees the standard form.
    const r = standardize("Prescribed 50000mg.");
    expect(r.flags.some((f) => f.kind === "implausible-quantity")).toBe(true);
  });

  it("does not flag a normal prescription", () => {
    const r = standardize("Prescribed amoxicillin 500 mg tid.");
    expect(r.flags.some((f) => f.kind === "implausible-quantity")).toBe(false);
  });

  it("stays fast on a number-heavy note", () => {
    const input = "Gave 500 mg and 20 mL and 4 mm. ".repeat(500);
    const started = Date.now();
    findImplausibleQuantities(input);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
