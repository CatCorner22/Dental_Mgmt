import { describe, expect, it } from "vitest";
import {
  runDoseArithmeticRule,
  runHouseholdUnitRule,
  runInteractionRule,
  runMedicationSafetyRules,
  runMixedUnitsRule,
  runOpioidPmpRule,
  runWeightUnitRule
} from "./medication-safety";

// The Mockingbird gates. Every test here encodes a documented harm pattern —
// the point is that the note is STOPPED, the reason is stated in cold logic,
// and no finding ever computes or proposes a dose.

describe("weight units", () => {
  it("stops a pounds weight beside a per-kilogram dose at S1", () => {
    const f = runWeightUnitRule("Weight 44 lb. Amoxicillin 40 mg/kg divided tid.");
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("S1");
    expect(f[0].ruleId).toBe("medsafe.lb-with-mg-per-kg");
    expect(f[0].message).toMatch(/pounds/i);
    expect(f[0].suggestion).toMatch(/kilograms/i);
  });

  it("reviews a pounds weight in any dosing note at S2", () => {
    const f = runWeightUnitRule("Weight 180 lbs. Ibuprofen 600 mg dispensed.");
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("S2");
  });

  it("stays silent when the weight is in kilograms", () => {
    expect(runWeightUnitRule("Weight 20 kg. Amoxicillin 40 mg/kg divided tid.")).toHaveLength(0);
  });

  it("stays silent with no dose at all", () => {
    expect(runWeightUnitRule("Patient reports weight around 150 lbs.")).toHaveLength(0);
  });
});

describe("dose arithmetic", () => {
  it("stops when the total is more than double the stated basis for a day", () => {
    // 20 kg at 40 mg/kg = 800 mg/day ceiling x2 = 1600. 4000 mg cannot agree.
    const f = runDoseArithmeticRule("Weight 20 kg. Amoxicillin 40 mg/kg per day. Gave 4000 mg.");
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("S1");
    // The finding must never state the expected value.
    expect(f[0].message).not.toMatch(/800/);
    expect(f[0].suggestion).not.toMatch(/800/);
  });

  it("accepts totals inside the generous envelope", () => {
    expect(
      runDoseArithmeticRule("Weight 20 kg. Amoxicillin 40 mg/kg per day. 267 mg three times daily.")
    ).toHaveLength(0);
  });

  it("needs all three numbers to say anything", () => {
    expect(runDoseArithmeticRule("Amoxicillin 40 mg/kg per day prescribed.")).toHaveLength(0);
    expect(runDoseArithmeticRule("Weight 20 kg. Gave 500 mg.")).toHaveLength(0);
  });
});

describe("household units", () => {
  it("flags teaspoons and tablespoons", () => {
    const f = runHouseholdUnitRule("Take one teaspoon twice daily.");
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("S2");
    expect(f[0].suggestion).toMatch(/millilitres|oral syringe/i);
  });

  it("counts occurrences", () => {
    const f = runHouseholdUnitRule("1 tsp now, then 1 tsp nightly.");
    expect(f[0].occurrences).toBe(2);
  });

  it("ignores metric instructions", () => {
    expect(runHouseholdUnitRule("Give 5 mL by oral syringe twice daily.")).toHaveLength(0);
  });
});

describe("mixed units", () => {
  it("flags kg and lb in one note", () => {
    const f = runMixedUnitsRule("Weight 20 kg (44 lb per parent).");
    expect(f.some((x) => x.ruleId === "medsafe.mixed-weight-units")).toBe(true);
  });

  it("flags mm with inches", () => {
    const f = runMixedUnitsRule("Lesion 6 mm from the margin, about 0.25 inches wide.");
    expect(f.some((x) => x.ruleId === "medsafe.mixed-length-units")).toBe(true);
  });

  it("stays silent on a single system", () => {
    expect(runMixedUnitsRule("Pocket depths 4-6 mm. Weight 70 kg.")).toHaveLength(0);
  });
});

describe("interaction screens", () => {
  it("stops warfarin + metronidazole at S1 with the reason stated", () => {
    const f = runInteractionRule("Medical history: warfarin. Prescribed metronidazole 500 mg tid.");
    const hit = f.find((x) => x.ruleId === "medsafe.interaction.warfarin-metronidazole");
    expect(hit?.severity).toBe("S1");
    expect(hit?.message).toMatch(/CYP2C9|bleeding/i);
    expect(hit?.suggestion).toMatch(/prescriber|decision/i);
  });

  it("stops epinephrine + propranolol at S1", () => {
    const f = runInteractionRule(
      "Medications: propranolol 80 mg daily. Lidocaine 2% with epinephrine 1:100,000 administered."
    );
    const hit = f.find((x) => x.ruleId === "medsafe.interaction.epinephrine-nonselective-beta-blocker");
    expect(hit?.severity).toBe("S1");
  });

  it("stops NSAID + lithium at S1, including brand names", () => {
    const f = runInteractionRule("Takes lithium for bipolar disorder. Recommended Advil for pain.");
    const hit = f.find((x) => x.ruleId === "medsafe.interaction.nsaid-lithium");
    expect(hit?.severity).toBe("S1");
  });

  it("downgrades to informational when the sentence shows the pair was avoided", () => {
    const f = runInteractionRule(
      "Medical history: warfarin therapy. Metronidazole avoided due to anticoagulation; penicillin VK prescribed instead."
    );
    const hit = f.find((x) => x.ruleId === "medsafe.interaction.warfarin-metronidazole");
    expect(hit?.severity).toBe("S3");
    expect(hit?.message).toMatch(/explicit/i);
  });

  it("says nothing when only one agent appears", () => {
    expect(runInteractionRule("Prescribed metronidazole 500 mg tid for 7 days.")).toHaveLength(0);
    expect(runInteractionRule("Medical history includes warfarin.")).toHaveLength(0);
  });

  it("flags metronidazole + alcohol advisory at S2", () => {
    const f = runInteractionRule("Prescribed metronidazole. Discussed alcohol restriction.");
    const hit = f.find((x) => x.ruleId === "medsafe.interaction.metronidazole-alcohol");
    expect(hit).toBeDefined();
  });

  it("flags NSAID + asthma history", () => {
    const f = runInteractionRule("History of asthma. Ibuprofen 600 mg prescribed for pain.");
    expect(f.some((x) => x.ruleId === "medsafe.interaction.nsaid-asthma")).toBe(true);
  });

  it("never proposes a dose or a drug", () => {
    const all = runMedicationSafetyRules(
      "Weight 44 lb. Warfarin per history. Metronidazole 40 mg/kg prescribed, gave 4000 mg, one tablespoon twice daily."
    );
    expect(all.length).toBeGreaterThan(2);
    for (const f of all) {
      expect(f.suggestion ?? "").not.toMatch(/did you mean|should be \d|correct dose/i);
    }
  });
});

describe("opioid PMP/CSMD gate", () => {
  it("stops an opioid prescription with no documented database check", () => {
    const f = runOpioidPmpRule("Prescribed hydrocodone 5/325, 8 tablets, for post-operative pain.");
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("S1");
    expect(f[0].message).toMatch(/CSMD|PMP/);
  });

  it("recognizes brand names and Tylenol #3", () => {
    expect(runOpioidPmpRule("Rx Percocet sent to pharmacy.")).toHaveLength(1);
    expect(runOpioidPmpRule("Prescribed Tylenol #3 for three days.")).toHaveLength(1);
  });

  it("is satisfied by a recorded check, in either word order", () => {
    expect(
      runOpioidPmpRule("CSMD reviewed prior to prescribing. Prescribed hydrocodone 5/325, 8 tablets.")
    ).toHaveLength(0);
    expect(
      runOpioidPmpRule("Prescribed tramadol 50 mg. Checked the prescription monitoring database before sending.")
    ).toHaveLength(0);
  });

  it("stays silent when the opioid is history, not a prescription", () => {
    expect(runOpioidPmpRule("Medical history: prior oxycodone use after knee surgery.")).toHaveLength(0);
  });

  it("stays silent for non-opioid prescriptions", () => {
    expect(runOpioidPmpRule("Prescribed ibuprofen 600 mg for 5 days.")).toHaveLength(0);
  });
});
