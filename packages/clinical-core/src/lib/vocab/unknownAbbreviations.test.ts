import { describe, expect, it } from "vitest";
import { unknownAbbreviations } from "./unknownAbbreviations";

// The local-vocabulary signal. A preloaded national list gets most of the way and
// the remainder is always local, so the tool counts what it cannot read and hands
// the ranking to a human. Nothing here adjusts a rule.

const tokens = (notes: string[], opts?: { minNotes?: number }) =>
  unknownAbbreviations(notes, opts).map((e) => e.token);

describe("what it reports", () => {
  it("finds a local initialism that recurs across notes", () => {
    const found = unknownAbbreviations([
      "Seated the ZRX crown on tooth 19.",
      "ZRX crown delivered, occlusion adjusted.",
      "Ordered a ZRX for tooth 14."
    ]);
    expect(found[0]).toEqual({ token: "zrx", count: 3, notes: 3 });
  });

  it("ignores a token that appears in only one note", () => {
    // One occurrence is somebody's slip. Vocabulary is what several people use,
    // and reporting slips is how a signal becomes a list nobody reads.
    expect(tokens(["Seated the ZRX crown.", "Prophylaxis completed."])).toEqual([]);
  });

  it("ranks by how many notes use it, not by raw frequency", () => {
    // A term four people write matters more than one somebody typed eight times
    // in a single note.
    const found = unknownAbbreviations([
      "ZQX ZQX ZQX ZQX ZQX ZQX. YKB here.",
      "ZQX again. YKB here.",
      "YKB here.",
      "YKB here."
    ]);
    expect(found.map((e) => e.token)).toEqual(["ykb", "zqx"]);
  });
});

describe("what it stays quiet about", () => {
  it("says nothing about ordinary clinical prose", () => {
    // The test that decides whether anyone keeps this panel open.
    expect(
      tokens([
        "The clinician examined the anterior teeth and found no caries.",
        "Probing depths ranged from 3 to 5 mm with generalized bleeding on probing.",
        "Postoperative instructions were reviewed with the patient before discharge.",
        "The clinician examined the anterior teeth and found no caries."
      ])
    ).toEqual([]);
  });

  it("says nothing about shorthand the tables already know", () => {
    // Reporting RCT, SRP or BWX as unrecognised would be the tool asking to be
    // taught something it already enforces.
    expect(
      tokens([
        "RCT #19 completed. SRP UR quad. BWX taken. NKA. w/o complication.",
        "RCT #30 completed. SRP UL quad. BWX taken. NKA. w/o complication."
      ])
    ).toEqual([]);
  });

  it("does not chase misspellings, which the spelling rule owns", () => {
    // "abcess" is a word-shaped typo, not an initialism. Two rules reporting the
    // same token in different words is how staff learn to trust neither.
    expect(tokens(["Drained the abcess today.", "The abcess resolved."])).toEqual([]);
  });

  it("ignores the tool's own submission stamp", () => {
    // The first thing this panel reported in a browser was "dn" — the DN-000034
    // ticket prefix out of the frozen stamp — as shorthand the practice uses and
    // the tool cannot read. True, absurd, and exactly the kind of finding that
    // teaches a lead to stop opening the page.
    const filed = (ticket: string) =>
      `# De-identified Smile Note draft\n\nProphylaxis completed.\n\n## Submission record\n\n- Ticket: ${ticket}\n- Ruleset: 2.7.0\n- Filed: 2026-08-03 17:04 ET\n`;
    expect(tokens([filed("DN-000034"), filed("DN-000035"), filed("DN-000036")])).toEqual([]);
  });

  it("does not report a single letter or a long word", () => {
    expect(tokens(["Surface B restored.", "Surface B charted."])).toEqual([]);
    expect(tokens(["Periodontitis noted.", "Periodontitis staged."])).toEqual([]);
  });
});

describe("the shapes it recognises", () => {
  it("catches an initialism written in capitals", () => {
    expect(tokens(["Used VPQ cement.", "VPQ cement again."])).toContain("vpq");
  });

  it("catches a slashed construct, which prose does not produce", () => {
    expect(tokens(["Noted d/t swelling.", "Again d/t swelling."])).toContain("d/t");
  });

  it("catches a short vowel-free token even in lower case", () => {
    expect(tokens(["Placed the tmk liner.", "tmk liner again."])).toContain("tmk");
  });
});
