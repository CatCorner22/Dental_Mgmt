import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";
import { findImplausibleQuantities } from "./plausibility";

// The Joint Commission "Do Not Use" list, as executable regressions.
//
// Every item here was undetected before, and three independent sources plus a
// live reproduction pointed at the same set. These are not style rules: each
// one is a construct with a documented history of being MISREAD, where the
// misreading is a tenfold dose error.

const flags = (s: string) => standardize(s).flags.map((f) => f.display);
const quoted = (s: string) => findImplausibleQuantities(s).map((q) => q.matched);

describe("naked leading decimal — .5 mg", () => {
  // The transformer used to delete the space in front of the point, reading it
  // as stray punctuation: "Midazolam .5 mg IV." came out as "Midazolam.5 mg
  // IV.", welding a sedative dose onto the drug name in a legal record.
  it("keeps the space instead of gluing the dose to the drug name", () => {
    expect(standardize("Midazolam .5 mg IV.").text).toBe("Midazolam .5 mg IV.");
    expect(standardize("Triazolam .125 mg PO one hour before.").text).toContain("Triazolam .125 mg");
  });

  it("quotes the dose AS WRITTEN, never renormalized", () => {
    // This is the one that mattered most. The quantity scanner required a
    // leading digit, so ".50000 mg" was captured as "50000 mg" and reported
    // back to the clinician as a number one hundred thousand times what the
    // note said. A checker that misquotes the note is asserting a value, which
    // is the single thing this module exists not to do.
    expect(quoted("Gave .50000 mg.")).toEqual([".50000 mg"]);
    expect(quoted("Gave .50000 mg.")[0]).not.toBe("50000 mg");
  });

  it("raises it, because the construct itself is prohibited", () => {
    expect(flags("Midazolam .5 mg IV.")).toContain(".5 mg");
  });

  it("never proposes the corrected value", () => {
    const [q] = findImplausibleQuantities("Midazolam .5 mg IV.");
    expect(q.reason).toContain("will not rewrite a dose");
    // The safe rewrite is obvious — "0.5" — and is still not offered. Two
    // keystrokes are not worth breaking the contract that the tool never
    // supplies a clinical value.
    expect(q.reason).not.toContain("0.5 mg");
  });
});

describe("trailing zero — 1.0 mg", () => {
  it("is raised, since a missed point reads as ten times the dose", () => {
    expect(flags("Amoxicillin 1.0 g PO.")).toContain("1.0 g");
    expect(quoted("Amoxicillin 1.0 g PO.")).toEqual(["1.0 g"]);
  });
});

describe("U and IU — the worst prior miss", () => {
  // "insulin 10U" passed the audit completely clean. U read as a zero turns
  // ten units into a hundred.
  it("flags U attached to a number, in either case", () => {
    expect(flags("Insulin 10U subcutaneous.")).toContain("U (units)");
    expect(flags("Gave 10 u of insulin.")).toContain("U (units)");
  });

  it("does not flag a bare capital U in ordinary prose", () => {
    // A lone U is far likelier to be an initial than a unit, and crying wolf
    // is how a warning stops being read.
    expect(flags("Patient U. Smith rescheduled.")).not.toContain("U (units)");
  });
});

describe("MS / MSO4 / MgSO4", () => {
  it("is raised, because it means two different drugs", () => {
    // Morphine sulfate and magnesium sulfate, confused in both directions.
    expect(flags("MS 4 mg given.")).toContain("MS / MSO4 / MgSO4");
    expect(flags("MgSO4 administered.")).toContain("MS / MSO4 / MgSO4");
  });
});

describe("cc — the lowercase form is the dangerous one", () => {
  it("flags lowercase cc, which was previously invisible", () => {
    // The pattern was uppercase-only, so only a shouted "CC" was ever raised —
    // and a volume is written lowercase. The ambiguity promise was being kept
    // for the harmless casing and broken for the harmful one.
    expect(flags("2 cc of lidocaine infiltrated.")).toContain("CC");
    expect(flags("CC: pain on the lower right.")).toContain("CC");
  });

  it("still refuses to choose between the two meanings", () => {
    // "2 cc of lidocaine" must never become "2 chief complaint of lidocaine".
    expect(standardize("2 cc of lidocaine infiltrated.").text).toContain("2 cc");
  });
});

describe("PPD and MOD — on the practice's list, absent from the app", () => {
  it("raises PPD without resolving it", () => {
    // Probing pocket depth in a perio chart; purified protein derivative (the
    // tuberculin test) in a medical history. Expanding the wrong one deletes a
    // systemic finding.
    expect(flags("PPD 5 mm distal of 30.")).toContain("PPD");
    expect(standardize("PPD 5 mm distal of 30.").text).toContain("PPD");
  });

  it("recognises surface combinations typed in prose", () => {
    expect(flags("MOD composite placed on 14.")).toContain("MOD");
    // Never expanded — the letters already carry the fact exactly, in order.
    expect(standardize("MOD composite placed on 14.").text).toContain("MOD");
  });

  it.each([
    ["History of MI in 2019.", "myocardial infarction"],
    ["Patient reports OD of acetaminophen last year.", "overdose"],
    ["Referred by her OB.", "obstetrician"],
    ["Seen by Dr. Patel, DO.", "Doctor of Osteopathy"],
    ["History of DI managed with desmopressin.", "diabetes insipidus"],
    ["DO NOT USE the old chart.", "a capitalised ordinary word"]
  ])("does NOT read %j as a surface combination (%s)", (input) => {
    // The first version of the MOD pattern accepted two-letter combinations
    // and flagged every one of these. Mislabelling a cardiac history as tooth
    // anatomy is the cries-wolf failure arriving from the other direction, and
    // it costs more than the recognition it buys — this entry never expands
    // anything, so under-recognising is invisible while over-recognising
    // teaches staff to dismiss the flags.
    expect(flags(input)).not.toContain("MOD");
  });
});

describe("scoping — the dose rules must not fire on measurements", () => {
  // The module header warns that a checker which cries wolf gets ignored. A
  // periodontal chart is full of decimals, and nobody is harmed by misreading
  // a probing depth by a factor of ten — so these rules are scoped to units
  // that carry a drug amount, and this is the test that keeps them there.
  it.each([
    "Probing depth 3.0 mm on tooth 30.",
    "Recession .5 mm at the buccal.",
    "Restored tooth 19 and tooth 30.",
    "Blood pressure 120/80 mm Hg.",
    "27 gauge needle used."
  ])("leaves %j alone", (input) => {
    expect(quoted(input)).toEqual([]);
  });
});
