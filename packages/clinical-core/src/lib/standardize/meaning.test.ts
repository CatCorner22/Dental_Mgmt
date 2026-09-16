import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";

// The contract that matters more than every other test in this file combined:
// THE TRANSFORMER MUST NEVER CHANGE WHAT THE NOTE SAYS.
//
// It rewrites wording. It does not rewrite facts. A note that leaves this
// function asserting something the clinician did not write is a defect of a
// different kind from a formatting slip — it is a falsified medical record.
//
// These tests are written as invariants over realistic clinical text rather
// than as examples, so they keep holding as the vocabulary tables grow.

const NEGATIONS = [
  "No bleeding was observed.",
  "The patient denies pain.",
  "Extraction was completed without complication.",
  "Non-restorable tooth 19.",
  "No known drug allergies.",
  "The patient did not consent to the procedure.",
  "No radiographic evidence of pathology.",
  "Never smoked.",
  "Patient reports no numbness."
];

describe("meaning is preserved — negations survive intact", () => {
  it.each(NEGATIONS)("keeps the negation in %j", (input) => {
    const out = standardize(input).text;
    // Every negating token in the input must still be present in the output.
    for (const neg of ["No", "no", "denies", "without", "Non-", "not", "Never", "never"]) {
      if (input.includes(neg)) {
        expect(out.toLowerCase(), `lost "${neg}"`).toContain(neg.toLowerCase());
      }
    }
  });

  it("never INTRODUCES a negation that was not written", () => {
    const positives = [
      "Bleeding was observed.",
      "The patient reports pain.",
      "Consent was obtained and recorded.",
      "Restorable tooth 19."
    ];
    for (const p of positives) {
      const out = standardize(p).text.toLowerCase();
      // A bare "no"/"not"/"never" appearing from nowhere would invert meaning.
      expect(/\bno\b|\bnot\b|\bnever\b|\bdenies\b/.test(out), p).toBe(false);
    }
  });
});

describe("meaning is preserved — numbers are never altered", () => {
  it("keeps every digit sequence exactly", () => {
    const inputs = [
      "Probing depths 3, 4, and 5 mm on tooth 19.",
      "Prescribed 500 mg three times daily.",
      "2 carpules of anesthetic.",
      "Blood pressure 128 over 82.",
      "Tooth 3 and tooth 14 restored.",
      "Recall in 6 months."
    ];
    for (const input of inputs) {
      const out = standardize(input).text;
      const before = input.match(/\d+/g) ?? [];
      const after = out.match(/\d+/g) ?? [];
      // Same numbers, same order. Spacing may change; values may not.
      expect(after, input).toEqual(before);
    }
  });
});

describe("meaning is preserved — tooth designations are never rewritten", () => {
  it("leaves ADA designations untouched", () => {
    for (const input of [
      "Restored tooth 19.",
      "Extracted teeth 1, 16, 17, and 32.",
      "Sealant on tooth A.",
      "Composite on tooth T."
    ]) {
      const out = standardize(input).text;
      for (const m of input.match(/\b(?:tooth|teeth)\s+[\w, and]+/gi) ?? []) {
        // The designation characters themselves must survive.
        for (const tok of m.match(/\b[A-T]\b|\b\d{1,2}\b/g) ?? []) {
          expect(out, `${input} lost ${tok}`).toContain(tok);
        }
      }
    }
  });
});

describe("meaning is preserved — the clinician's own words are not deleted", () => {
  // A transform that silently drops a clause is the worst failure mode here,
  // because nothing on screen says anything went missing.
  it("never shrinks the substantive word count", () => {
    const inputs = [
      "Patient presented for evaluation of pain in the lower right quadrant.",
      "Anesthesia was administered and the tooth was isolated with a dental dam.",
      "The restoration was finished, polished, and the occlusion was checked.",
      "Postoperative instructions were reviewed with the patient and a caregiver."
    ];
    for (const input of inputs) {
      const out = standardize(input).text;
      const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
      // Expansions can only ADD words; nothing here should remove any.
      expect(words(out), input).toBeGreaterThanOrEqual(words(input));
    }
  });
});

describe("idempotency across realistic notes", () => {
  const NOTES = [
    "pt presents for RCT on tooth 19. BW and PA taken. RCT started.",
    "SRP quad 1 done, SRP quad 2 next. no BOP noted.",
    "used MTA and GP point. gave LA, N2O used.",
    "rx amoxicilin 500mg tid prn. f/u 2 wks. NKDA.",
    "Composite placed on the mesial surface of tooth 3.",
    "no complications. pt tolerated well. d/c home in stable condition.",
    "CBCT ordered. IANB given. BOP present at 4 sites.",
    "# Findings\n- one\n- two",
    "",
    "   ",
    "PA PA PA PA",
    "RCT (RCT) RCT"
  ];

  it.each(NOTES)("standardizing twice equals standardizing once: %j", (note) => {
    const once = standardize(note).text;
    const twice = standardize(once).text;
    expect(twice).toBe(once);
  });

  it("is stable over three passes on a combined note", () => {
    const combined = NOTES.join(" ");
    const a = standardize(combined).text;
    const b = standardize(a).text;
    const c = standardize(b).text;
    expect(b).toBe(a);
    expect(c).toBe(a);
  });
});

describe("no crash and no hang on hostile input", () => {
  it.each([
    ["repeated periods", ".".repeat(5000)],
    ["repeated hashes", "#".repeat(5000)],
    ["digits and spaces", "9".repeat(2000) + " ".repeat(2000)],
    ["mixed punctuation", "(),.;:!?".repeat(2000)],
    ["newline storm", "\n".repeat(5000)],
    ["unicode soup", "​­—‘“".repeat(2000)],
    ["abbreviation storm", "RCT BW SRP PA GP LA ".repeat(1000)],
    ["nested parens", "(".repeat(2000) + ")".repeat(2000)]
  ])("survives %s quickly", (_label, input) => {
    const started = Date.now();
    const r = standardize(input);
    expect(Date.now() - started, _label).toBeLessThan(2000);
    expect(typeof r.text).toBe("string");
  });
});

// Regression: the pattern VARIANTS that broke idempotency.
//
// Several shorthand patterns match more than their canonical spelling — BWX,
// FMS, pano, VDO, and the dotted dosing forms. The definition used to be
// written with the matched text while the already-defined guard looked for the
// canonical form, so a second pass produced
// "bitewing radiograph (bitewing radiograph (BWX))".
//
// These are kept as their own block because a new entry in SHORTHAND with an
// optional group or a character class reintroduces exactly this bug, and the
// generic idempotency tests above all happen to use canonical spellings.
describe("regression — pattern variants stay idempotent", () => {
  const VARIANTS = [
    "4 x-rays and a BWX taken; PANO reviewed. FMS from last visit compared.",
    "BWX taken of the posterior teeth.",
    "FMS compared with the previous series.",
    "pano reviewed.",
    "VDO measured at the try-in.",
    "Amoxicillin 500 mg b.i.d. for seven days.",
    "Ibuprofen 600 mg t.i.d. as tolerated.",
    "Ibuprofen p.r.n. pain."
  ];

  it.each(VARIANTS)("twice equals once: %j", (input) => {
    const once = standardize(input).text;
    const twice = standardize(once).text;
    expect(twice, `NOT IDEMPOTENT: ${input}`).toBe(once);
  });

  it("never nests a definition inside a definition", () => {
    for (const v of VARIANTS) {
      const out = standardize(standardize(v).text).text;
      // "expansion (expansion (ABBR))" is the exact shape of the old bug.
      expect(out, v).not.toMatch(/\([^()]*\([^()]*\)/);
    }
  });

  it("normalizes a variant to the canonical spelling", () => {
    // Standardizing is the job: BWX and b.i.d. come out as the one spelling
    // the practice agreed on, not as whatever was typed.
    expect(standardize("BWX taken.").text).toContain("(BW)");
    expect(standardize("Amoxicillin b.i.d.").text).toContain("(bid)");
  });

  it("does NOT normalize FMS to FMX — that is a different diagnosis", () => {
    // This assertion used to run the other way, pinning the defect: FMS was
    // folded into the FMX entry, so "Medical history: FMS, hypertension" came
    // out as "full-mouth radiographic series, hypertension" — a diagnosis
    // deleted and an imaging study invented in its place. In a dental note FMS
    // is usually a slip for FMX; in a medical history it is fibromyalgia
    // syndrome. Only the person who took the history knows which.
    const out = standardize("Medical history: FMS, hypertension, and asthma.");
    expect(out.text).not.toContain("radiographic series");
    expect(out.text).toContain("FMS");
    // Coverage is not lost — it is raised for a human instead of guessed.
    expect(out.flags.some((f) => f.display === "FMS")).toBe(true);
  });
});
