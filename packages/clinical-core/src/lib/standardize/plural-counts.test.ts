import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";

// REGRESSION: the first-use expansion destroyed plural counts.
//
// "SSCs placed on teeth A and B" became "stainless steel crown (SSC) placed
// on teeth A and B" — ONE crown documented for TWO teeth. PR #19 fixed this
// for second occurrences (applyPlural on the display), but the FIRST
// occurrence still replaced a plural token with a singular multi-word
// expansion, because applyPlural refuses to pluralise a phrase. A count is a
// billing and legal fact; these tests pin the plural-preserving expansion
// (Shorthand.pluralExpansion) so the bug cannot return.

describe("plural first-use expansion preserves the count", () => {
  it.each([
    ["SSCs placed on teeth A and B.", "stainless steel crowns (SSCs)"],
    ["TMJs palpated bilaterally, no clicking.", "temporomandibular joints (TMJs)"],
    ["4 BWs acquired.", "4 bitewing radiographs (BWs)"],
    ["PARLs noted at apices of 8 and 9.", "periapical radiolucencies (PARLs)"],
    ["Two RCTs completed this year.", "root canal therapies (RCTs)"],
    ["FPDs evaluated at recall.", "fixed partial dentures (FPDs)"],
    ["RPDs delivered and adjusted.", "removable partial dentures (RPDs)"],
    ["Bilateral IANBs administered.", "inferior alveolar nerve blocks (IANBs)"]
  ])("%s expands to a plural definition", (input, expected) => {
    expect(standardize(input).text.toLowerCase()).toContain(expected.toLowerCase());
  });

  it("never emits a singular expansion for a plural token", () => {
    const out = standardize("SSCs placed on teeth A and B.").text;
    expect(out).not.toMatch(/stainless steel crown \(SSC\)/);
  });

  it("reports the actual plural token in the change list", () => {
    const r = standardize("SSCs placed on teeth A and B.");
    const change = r.applied.find((a) => a.kind === "shorthand");
    expect(change?.from).toBe("SSCs");
    expect(change?.to).toBe("stainless steel crowns (SSCs)");
  });

  it("a plural with no safe written plural is left alone, not miscounted", () => {
    // "CBCTs" means multiple scans; "cone-beam computed tomography scans"
    // would add a noun the writer never typed, and the singular would change
    // the count. The token stays as shorthand.
    const out = standardize("CBCTs reviewed with the surgeon.").text;
    expect(out).toContain("CBCTs");
    expect(out).not.toContain("cone-beam");
  });

  it("a later singular occurrence still carries the definition when the first was an unexpandable plural", () => {
    const out = standardize("CBCTs compared. CBCT of 30 acquired.").text;
    expect(out).toContain("CBCTs compared");
    expect(out.toLowerCase()).toContain("cone-beam computed tomography (cbct)");
  });

  it("mixed singular-then-plural defines on the singular and normalises the plural", () => {
    const out = standardize("BW taken on the right. 2 BWXs on the left.").text;
    expect(out.toLowerCase()).toContain("bitewing radiograph (bw)");
    expect(out).toContain("2 BWs");
  });

  it("plural definitions are idempotent", () => {
    for (const input of [
      "SSCs placed on teeth A and B.",
      "4 BWs acquired.",
      "TMJs palpated bilaterally."
    ]) {
      const once = standardize(input).text;
      const twice = standardize(once).text;
      expect(twice).toBe(once);
      expect(twice).not.toMatch(/\([^()]*\([^()]*\)/);
    }
  });
  it("reports a normalisation it could not expand, instead of editing silently", () => {
    // "cbcts" comes out "CBCTs" — a real edit to clinical text. The plural
    // guard correctly declines to EXPAND it (CBCT has no plural in the table,
    // and inventing one could change a count), but the early return also
    // skipped the reporting, so `applied` came back empty and the panel said
    // "tidied". The list of changes a human accepts has to contain the changes.
    const r = standardize("cbcts reviewed");
    expect(r.text).toContain("CBCTs");
    const real = r.applied.filter((a) => a.kind !== "formatting");
    expect(real.map((a) => `${a.from} -> ${a.to}`)).toContain("cbcts -> CBCTs");
    expect(real[0].why).toMatch(/normalised only/i);
  });

  it("reports nothing when the token was already canonical", () => {
    // The guard must not manufacture a change entry for text it left alone.
    const r = standardize("CBCTs reviewed.");
    expect(r.applied.filter((a) => a.kind !== "formatting")).toEqual([]);
  });
});
