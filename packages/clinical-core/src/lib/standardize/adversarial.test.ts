import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";
import { buildWordMap } from "./wordMap";

// Regressions from the adversarial pass. Each block names the defect it pins,
// because a bare assertion tells the next reader nothing about why it matters.

describe("S1 — a dosing abbreviation must not split the prescription", () => {
  // "p.r.n." left an orphan period, which sentenceCase then read as a sentence
  // boundary: "Ibuprofen 600 mg as needed (prn). Pain." — turning the
  // indication into a standalone clinical assertion nobody wrote.
  it.each([
    ["ibuprofen 600 mg p.r.n. pain", "pain"],
    ["amoxicillin 500 mg t.i.d. x 7 days", "7 days"],
    ["chlorhexidine b.i.d. rinse, do not swallow", "rinse"],
    ["acetaminophen q.i.d. max 3 g per day", "max 3 g per day"]
  ])("keeps %j as one sentence", (input, tail) => {
    const out = standardize(input).text;
    // The tail must NOT have been promoted to its own capitalized sentence.
    const promoted = new RegExp(`\\.\\s+${tail[0].toUpperCase()}${tail.slice(1)}`);
    expect(out, out).not.toMatch(promoted);
  });

  it("raises prn for a human instead of expanding it", () => {
    // This used to assert the expansion. Expanding produced "600 mg as needed
    // (prn) pain" — broken grammar, because "prn X" means "as needed FOR X" —
    // and a later rule then flagged "as needed" as vague, so the tool told the
    // clinician to rewrite text the tool had just written. The fact actually
    // missing is the trigger condition, which only the prescriber can supply.
    const out = standardize("ibuprofen p.r.n. pain");
    expect(out.text.toLowerCase()).not.toContain("as needed (prn)");
    expect(out.flags.some((f) => f.display === "prn")).toBe(true);
  });
});

describe("S2 — initialisms with a real second meaning are never resolved", () => {
  it.each([
    ["gave 2 CC of 2% lidocaine", "CC"],
    ["hx of elevated PSA", "PSA"],
    ["CAL 600 mg supplement", "CAL"],
    ["EXT 4 on the temp", "EXT"]
  ])("leaves %j alone and flags it", (input, abbr) => {
    const r = standardize(input);
    expect(r.text, input).toContain(abbr);
    // No definition was written for it.
    expect(r.text, input).not.toMatch(new RegExp(`\\(${abbr}\\)`));
    expect(r.flags.some((f) => f.kind === "ambiguous-shorthand"), input).toBe(true);
  });
});

describe("S3 — a plural count is never destroyed", () => {
  it("keeps x-rays plural", () => {
    expect(standardize("4 x-rays taken").text).toContain("radiographs");
    expect(standardize("two x-rays of #3 and #14 taken").text).toContain("radiographs");
  });

  it("still handles the singular", () => {
    expect(standardize("an x-ray was taken").text).toContain("radiograph");
    expect(standardize("an x-ray was taken").text).not.toContain("radiographs");
  });
});

describe("S4 — all-caps PT is not a patient", () => {
  it("leaves PT alone", () => {
    // PT is physical therapy / prothrombin time. Expanding it — and SHOUTING
    // the expansion — invented a clinical statement.
    const out = standardize("PT referral placed").text;
    expect(out).toContain("PT");
    expect(out).not.toContain("PATIENT");
  });

  it("still expands lowercase pt", () => {
    expect(standardize("pt reports pain").text.toLowerCase()).toContain("patient");
  });
});

describe("S5 — a line break between a term and its definition stays idempotent", () => {
  it.each([
    "root canal therapy\n(RCT) done. RCT again.",
    "scaling and root planing\n(SRP) done.",
    "bitewing radiograph\n(BW) taken."
  ])("twice equals once for %j", (input) => {
    const once = standardize(input).text;
    const twice = standardize(once).text;
    expect(twice, `NOT IDEMPOTENT`).toBe(once);
    expect(twice).not.toMatch(/\([^()]*\([^()]*\)/); // no nested definition
  });
});

describe("S6 — coverage the old table had is not silently lost", () => {
  it.each(["PANO reviewed", "rct started", "srp completed", "bw taken", "FMS reviewed"])(
    "still acts on %j",
    (input) => {
      const r = standardize(input);
      const acted = r.applied.some((a) => a.kind === "shorthand") || r.flags.length > 0;
      expect(acted, `${input} -> ${r.text}`).toBe(true);
    }
  );

  it("still flags NKA, not just NKDA", () => {
    const r = standardize("NKA per patient");
    expect(r.applied.some((a) => a.kind === "shorthand") || r.flags.length > 0).toBe(true);
  });
});

describe("S8 — no double punctuation at the end of a line", () => {
  it.each(["no bleeding,", "sites: MB, DB -"])("leaves %j without adding a period", (input) => {
    const out = standardize(input).text;
    expect(out).not.toMatch(/,\.$/);
    expect(out).not.toMatch(/-\.$/);
  });
});

describe("S9 — a replacement is not capitalized mid-sentence", () => {
  it("keeps an expansion lowercase in the middle of a sentence", () => {
    const out = standardize("The abscess required I&D at the buccal space").text;
    expect(out).not.toMatch(/required Incision/);
  });

  it("still capitalizes at a real sentence start", () => {
    expect(standardize("pt reports pain.").text).toMatch(/^Patient/);
  });
});

describe("S10 — percent signs are left alone", () => {
  it("does not split a percentage", () => {
    expect(standardize("lidocaine 2% with epi").text).toContain("2%");
    expect(standardize("lidocaine 2% with epi").text).not.toContain("2 %");
  });

  it("does not space a colon used as notation", () => {
    expect(standardize("epi 1:100,000").text).toContain("1:100,000");
  });
});

describe("S11 — modern bidi isolates and hard spaces are neutralized", () => {
  it("strips LRI/RLI/FSI/PDI", () => {
    const out = standardize("no caries ⁧on #3 4mm⁩ noted").text;
    expect(out).not.toMatch(/[⁦-⁩]/);
  });

  it("collapses a non-breaking space so unit spacing still works", () => {
    expect(standardize("probing depth 4 mm").text).not.toMatch(/ /);
  });
});

describe("S12 — the word map matches what the transformer actually does", () => {
  it("does not advertise a replacement the shorthand table has taken over", () => {
    const groups = buildWordMap();
    const autoGroup = groups.find((g) => g.id === "auto-abbreviations")!;
    const advertised = autoGroup.entries.map((e) => e.avoid.toLowerCase());
    // These are owned by SHORTHAND (defined on first use), so they must not
    // appear under "shorthand the tool expands for you".
    for (const owned of ["rct", "srp", "bw / bwx", "pano", "n2o", "la"]) {
      expect(advertised, owned).not.toContain(owned);
    }
  });

  it("promises the first-use behaviour for the terms it owns", () => {
    const shorthandGroup = buildWordMap().find((g) => g.id === "shorthand")!;
    const rct = shorthandGroup.entries.find((e) => e.avoid === "RCT");
    expect(rct?.use).toContain("(RCT)");
  });
});
