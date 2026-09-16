import { describe, expect, it } from "vitest";
import {
  ANAESTHETIC_LIMITS,
  epinephrineMg,
  milligramsFrom,
  runAnaestheticDoseRule
} from "./anesthetic-dose";

const ids = (text: string) => runAnaestheticDoseRule(text).map((f) => f.ruleId);
const messages = (text: string) => runAnaestheticDoseRule(text).map((f) => f.message);

describe("the conversions this rule rests on", () => {
  it("reads a percentage as grams per 100 mL", () => {
    // 2% is 20 mg/mL, so a 1.8 mL carpule is 36 mg. This single number is what
    // the whole rule depends on.
    expect(milligramsFrom(1.8, 2)).toBeCloseTo(36);
    expect(milligramsFrom(1.8, 4)).toBeCloseTo(72);
    expect(milligramsFrom(3.6, 2)).toBeCloseTo(72);
  });

  it("reads a 1:N epinephrine ratio", () => {
    expect(epinephrineMg(1.8, 100000)).toBeCloseTo(0.018);
    expect(epinephrineMg(1.8, 50000)).toBeCloseTo(0.036);
  });
});

describe("ordinary care raises nothing", () => {
  it.each([
    "2 carp lido 2% w epi 1:100k",
    "1 carp lido 2%",
    "3 carp articaine 4%",
    "Prophylaxis completed. No anaesthetic given."
  ])("stays quiet on %j", (text) => {
    expect(runAnaestheticDoseRule(text).filter((f) => f.ruleId.includes("max"))).toEqual([]);
  });

  // The rule fires on EXCEEDANCE, never on approaching a limit. 8 carpules of
  // 2% lidocaine is 288 mg against a 300 mg ceiling — close, and not a finding.
  it("does not warn at 96% of the maximum", () => {
    expect(ids("8 carp lido 2%").filter((id) => id.includes("max"))).toEqual([]);
  });
});

describe("exceedance is reported with the working shown", () => {
  it("catches an adult exceeding the absolute maximum", () => {
    // 9 carpules x 1.8 mL x 2% = 324 mg, above the 300 mg lidocaine ceiling.
    const found = runAnaestheticDoseRule("9 carp lido 2%");
    expect(found.map((f) => f.ruleId)).toContain("dose.anaesthetic-max.lidocaine");
    expect(found[0].message).toContain("324");
    expect(found[0].message).toContain("300 mg");
  });

  it("uses the weight-based limit when the note documents a weight", () => {
    // A 20 kg child: 4.4 mg/kg = 88 mg. Three carpules of 2% is 108 mg.
    const found = runAnaestheticDoseRule("Weight 20 kg. 3 carp lido 2% administered.");
    expect(found.map((f) => f.ruleId)).toContain("dose.anaesthetic-max.lidocaine");
    expect(found[0].message).toContain("20 kg");
    expect(found[0].message).toContain("88");
  });

  it("takes whichever limit binds tighter", () => {
    // A 90 kg adult's weight limit (396 mg) is above the absolute 300 mg, so
    // the absolute one applies and 9 carpules still exceeds it.
    const found = runAnaestheticDoseRule("Weight 90 kg. 9 carp lido 2%.");
    expect(found[0].message).toContain("300 mg");
  });

  it("sums across several administrations in one note", () => {
    const found = runAnaestheticDoseRule("5 carp lido 2% at the start. 5 carp lido 2% later.");
    expect(found.map((f) => f.ruleId)).toContain("dose.anaesthetic-max.lidocaine");
    // 10 carpules total = 360 mg.
    expect(found[0].message).toContain("360");
  });

  it("shows the arithmetic so a clinician can check rather than trust", () => {
    expect(messages("9 carp lido 2%")[0]).toMatch(/16\.2 mL at 2% = 324 mg/);
  });
});

// ===========================================================================
// THE POSTURE. A clinical note is a RECORD. If a clinician gave more than the
// published maximum, the note MUST say so — that is the encounter where the
// record matters most. A gate that refused to file it would suppress the
// documentation of the event it was worried about.
// ===========================================================================
describe("it advises and never blocks", () => {
  it("is never S0 or S1, whatever the dose", () => {
    for (const text of ["40 carp lido 2%", "Weight 10 kg. 20 carp articaine 4%."]) {
      for (const f of runAnaestheticDoseRule(text)) {
        expect(f.severity, `${text} -> ${f.ruleId}`).toBe("S2");
      }
    }
  });

  it("tells the writer both ways it could be resolved", () => {
    const message = messages("9 carp lido 2%")[0];
    expect(message).toMatch(/if that is what was given/i);
    expect(message).toMatch(/correct it/i);
  });
});

describe("what it refuses to compute", () => {
  it("does not assume a concentration the note did not state", () => {
    // A carpule of 2% and a carpule of 4% are twice apart. Assuming the common
    // one would invent a clinical number.
    expect(runAnaestheticDoseRule("2 carp lido administered")).toEqual([]);
  });

  // THE REGRESSION THIS PINS. An earlier version raised "the dose cannot be
  // worked out from this note" whenever it could not assemble one — and fired
  // on this line, where the note states everything and only the extractor
  // fails, because the carpule count sits after a comma in the next clause.
  // Confidently wrong about a complete note is the worst kind of false
  // positive.
  it("stays silent when the note is complete but the extractor cannot assemble it", () => {
    const text =
      "Lidocaine 2% with epinephrine 1:100,000, 2 carpules, via inferior alveolar nerve block.";
    expect(runAnaestheticDoseRule(text)).toEqual([]);
  });

  it("does not count a planned dose as a dose given", () => {
    expect(ids("Will need 9 carp lido 2% if the block fails")).toEqual([]);
  });

  it("does not count a dose the note says was withheld", () => {
    expect(ids("No lidocaine given.")).toEqual([]);
  });

  it("does not treat a drug it has no published limit for as an anaesthetic", () => {
    expect(ids("ibuprofen 600 mg")).toEqual([]);
  });
});

describe("limits table integrity", () => {
  it("every limit is positive and the weight-based one is the tighter for a child", () => {
    for (const limit of ANAESTHETIC_LIMITS) {
      expect(limit.mgPerKg).toBeGreaterThan(0);
      expect(limit.absoluteMaxMg).toBeGreaterThan(0);
      // A 20 kg child must always be capped below the adult ceiling, or the
      // weight branch would be decorative.
      expect(limit.mgPerKg * 20).toBeLessThan(limit.absoluteMaxMg);
    }
  });

  it("has no duplicate drug entries", () => {
    const drugs = ANAESTHETIC_LIMITS.map((l) => l.drug);
    expect(new Set(drugs).size).toBe(drugs.length);
  });
});

describe("tolerance", () => {
  it.each(["", "   ", "\u0000", "carp carp carp", "2% 2% 2%", "lido".repeat(500)])(
    "never throws on %j",
    (text) => {
      expect(() => runAnaestheticDoseRule(text)).not.toThrow();
    }
  );

  it("is deterministic", () => {
    const text = "Weight 20 kg. 3 carp lido 2% administered.";
    const once = JSON.stringify(runAnaestheticDoseRule(text));
    expect(JSON.stringify(runAnaestheticDoseRule(text))).toBe(once);
  });
});
