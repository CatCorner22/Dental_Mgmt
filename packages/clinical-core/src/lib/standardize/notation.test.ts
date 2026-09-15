import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";
import { expandToothHash, punctuateSectionLabels } from "./notation";

// NOTATION. The passes that turn chart shorthand into something a reader outside
// dentistry can follow — which is the point, because a records request goes to an
// insurer, an attorney, or the next treating dentist, and "#14" means nothing to
// two of those three.
//
// A quality audit of real output is what prompted these: the transformer was
// producing "Perc + on #14 ... reappoint 6mo. Nka." — half-standard text with the
// most opaque construct in a dental note left untouched.

const out = (s: string) => standardize(s).text;

describe("tooth designators are written out", () => {
  it("turns #14 into tooth 14", () => {
    expect(out("Crown seated on #19.")).toContain("tooth 19");
  });

  it("drops the hash instead of repeating the word when the clause already says tooth", () => {
    // "teeth tooth 3 and tooth 14" is what naive replacement produces.
    expect(out("Sealants placed on teeth #3 and #14.")).toContain("teeth 3 and 14");
    expect(out("Extraction of tooth #17.")).toContain("tooth 17");
  });

  it("writes a range as teeth, not as two separate teeth", () => {
    // "#30-#31" must not become "tooth 30-tooth 31".
    expect(out("Composite #30-#31.")).toContain("teeth 30-31");
  });

  it("handles primary-tooth letters", () => {
    expect(out("Stainless steel crown on #K.")).toContain("tooth K");
  });

  it("leaves a number that cannot be a tooth alone", () => {
    // ADA Universal runs 1-32, with supernumeraries at 51-82. Anything else is not
    // a tooth, and turning a lot number into one would falsify the site.
    expect(out("Lot #4432 used for the restoration.")).toContain("#4432");
    expect(out("Lot #4432 used for the restoration.")).not.toContain("tooth 4432");
  });

  it("leaves an operatory number alone", () => {
    // A browser audit caught this: "Op #2" became "Op tooth 2". Operatory, lot,
    // room, chair and claim numbers all live in the low integers exactly where
    // tooth numbers do, so the word in front is the only discriminator.
    expect(out("Op #2. Crown seated on #19.")).toContain("Op #2");
    expect(out("Chair #4 prepared.")).toContain("#4");
    expect(out("Claim #12 submitted.")).toContain("#12");
  });
});

describe("numbers typed hard against an abbreviation", () => {
  it("separates 6mo into 6 months", () => {
    // There is no word boundary between "6" and "m", so the months rule could not
    // see it and "reappoint 6mo" survived every pass untouched. The un-gluing has
    // to happen BEFORE the vocabulary lookup, which is the whole fix.
    expect(out("Reappoint 6mo.")).toContain("6 months");
  });

  it("separates a dose from its unit", () => {
    expect(out("Ibuprofen 600mg every 6 hours.")).toContain("600 mg");
  });

  it("never splits a dosing abbreviation that contains its own digit", () => {
    // Splitting "q6h" would be far worse than failing to expand it.
    expect(out("Ibuprofen 600mg q6h.")).toContain("every 6 hours");
    expect(out("Ibuprofen 600mg q6h.")).not.toMatch(/q\s6/);
  });

  it("leaves an ordinary word glued to a number alone", () => {
    expect(out("Used 2carpules of anesthetic.")).toContain("2carpules");
  });
});

describe("duration shorthand", () => {
  it("turns x3 days into for 3 days", () => {
    expect(out("Pain x3 days.")).toContain("for 3 days");
  });

  it("leaves a dimension alone", () => {
    // Bounded to a following time word, so a measurement can never be rewritten
    // as a duration.
    expect(out("Lesion 2 x 4 mm on the buccal.")).toContain("2 x 4 mm");
  });
});

describe("initialism casing", () => {
  it("restores NKA rather than leaving the sentence-caser's Nka", () => {
    // sentenceCase uppercases the first letter after a terminator, which turned a
    // sentence-initial "nka." into "Nka." — an initialism in title case, which
    // reads as a typo in the one tool whose whole claim is standard form.
    expect(out("Prophylaxis completed. nka.")).toContain("NKA");
    expect(out("Prophylaxis completed. nka.")).not.toContain("Nka");
  });

  it("does NOT restore casing where the case decides the meaning", () => {
    // The bug this file's deny-list exists for. A sentence-initial "mod composite"
    // was sentence-cased to "Mod" and then "restored" to "MOD" — silently picking
    // the mesial-occlusal-distal reading of a token the tool refuses to guess at,
    // and asserting a billed surface the writer never named.
    const r = standardize("mod composite placed on tooth 30.");
    expect(r.text).not.toContain("MOD");
    // And it is still asked about, which is the correct handling.
    expect(r.flags.map((f) => f.display)).toContain("mod");
  });

  it("leaves the other case-deciding tokens alone too", () => {
    for (const [input, mustNotContain] of [
      ["cal 2 mm at the distal.", "CAL"],
      ["temp cemented today.", "TEMP"],
      ["imp taken for the crown.", "IMP"],
      ["ext completed without difficulty.", "EXT"]
    ] as const) {
      expect(out(input), input).not.toContain(mustNotContain);
    }
  });
});

describe("section labels", () => {
  it("gives a leading label its colon", () => {
    expect(out("dx irreversible pulpitis.")).toContain("Diagnosis: irreversible pulpitis");
  });

  it("does not drop a colon into the middle of a phrase", () => {
    // The idempotency property test caught this: "History of present illness (HPI)
    // recorded" was turned into "History: of present illness". A label is only a
    // label when what follows STARTS a statement.
    expect(punctuateSectionLabels("Diagnosis of the lesion is pending.")).toBe(
      "Diagnosis of the lesion is pending."
    );
    expect(punctuateSectionLabels("Diagnosis was recorded by the dentist.")).toBe(
      "Diagnosis was recorded by the dentist."
    );
    // And the words that are ordinary adjectives are not treated as labels at all,
    // because no stop-list of following words fixes that class.
    expect(punctuateSectionLabels("Objective findings were recorded.")).toBe(
      "Objective findings were recorded."
    );
    expect(punctuateSectionLabels("Assessment and plan discussed.")).toBe(
      "Assessment and plan discussed."
    );
  });

  it("does not add a second colon", () => {
    expect(punctuateSectionLabels("Diagnosis: irreversible pulpitis.")).toBe(
      "Diagnosis: irreversible pulpitis."
    );
  });
});

describe("structure is never destroyed", () => {
  it("keeps line breaks and list items apart", () => {
    // Splitting on newlines and rejoining with a space welded "- one\n- two" into
    // "- one - two". Paragraph breaks carry meaning in a clinical note — one
    // paragraph per phase of the visit — so losing them loses structure.
    expect(out("- one\n- two")).toBe("- one\n- two");
    expect(expandToothHash("Crown on #19.\n- follow up")).toBe("Crown on tooth 19.\n- follow up");
  });

  it("keeps paragraphs apart", () => {
    const r = out("Composite on #3.\n\nPostoperative instructions given.");
    expect(r.split("\n\n")).toHaveLength(2);
  });
});
