import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";

describe("standardize — deterministic rewrites are applied", () => {
  it("corrects a non-medication misspelling and reports it", () => {
    const r = standardize("Drained the abcess.");
    expect(r.text).toContain("abscess");
    expect(r.applied.find((a) => a.kind === "spelling")?.to).toBe("abscess");
  });

  it("expands shorthand that has exactly one standard expansion", () => {
    const r = standardize("Took an x-ray of the area.");
    expect(r.text).toContain("radiograph");
    expect(r.text).not.toMatch(/x-ray/i);
  });

  it("preserves capitalization when replacing", () => {
    expect(standardize("X-ray was taken.").text).toMatch(/^Radiograph/);
    expect(standardize("An x-ray was taken.").text).toContain("radiograph");
  });

  it("normalizes pasted punctuation and stray spacing", () => {
    const r = standardize("The  patient\u2019s tooth \u2014 restored .");
    expect(r.text).toContain("'");
    expect(r.text).not.toContain("\u2019");
    expect(r.text).not.toContain("\u2014");
    expect(r.text).not.toContain("  ");
    expect(r.text).not.toContain(" .");
  });

  it("strips invisible characters that survive a copy-paste", () => {
    const r = standardize("Composite\u200B placed\u00AD today");
    expect(r.text).not.toMatch(/[\u200B\u00AD]/);
  });

  it("adds a terminal period to a sentence that lacks one", () => {
    expect(standardize("Composite placed on the tooth").text).toMatch(/\.$/);
  });

  it("does not add a period to a heading or list item", () => {
    expect(standardize("# Findings").text).toBe("# Findings");
    expect(standardize("- one\n- two").text).toBe("- one\n- two");
  });

  it("reports a clean input as clean and changes nothing", () => {
    const r = standardize("Composite placed on the mesial surface.");
    expect(r.clean).toBe(true);
    expect(r.text).toBe("Composite placed on the mesial surface.");
  });
});

describe("standardize — judgement calls are flagged, never guessed", () => {
  // The single most important rule in this module. "amoxicilin" is almost
  // certainly amoxicillin, and "almost certainly" is not a standard a drug
  // name may be corrected on.
  it("NEVER auto-corrects a medication name", () => {
    const r = standardize("Prescribed amoxicilin 500 mg.");
    expect(r.text).toContain("amoxicilin"); // unchanged
    expect(r.text).not.toContain("amoxicillin");
    const flag = r.flags.find((f) => f.kind === "medication-spelling");
    expect(flag).toBeDefined();
    expect(flag!.guidance).toContain("amoxicillin");
    expect(r.applied.some((a) => a.kind === "spelling")).toBe(false);
  });

  it("flags shorthand whose expansion depends on hidden facts", () => {
    const r = standardize("PA taken today.");
    // Not rewritten — the tool cannot know which kind of radiograph.
    expect(r.text).toContain("PA");
    expect(r.flags.some((f) => f.kind === "abbreviation")).toBe(true);
  });

  it("flags a vague phrase without inventing the missing facts", () => {
    const r = standardize("The patient tolerated the procedure well.");
    expect(r.text).toContain("tolerated");
    const flag = r.flags.find((f) => f.kind === "vague-phrase");
    expect(flag).toBeDefined();
    expect(flag!.guidance).toContain("observed response");
  });

  it("counts repeats rather than listing the same item twice", () => {
    const r = standardize("An x-ray and another x-ray and a third x-ray.");
    const a = r.applied.find((x) => x.kind === "abbreviation");
    expect(a?.count).toBe(3);
    expect(r.applied.filter((x) => x.kind === "abbreviation")).toHaveLength(1);
  });
});

describe("standardize — safety and robustness", () => {
  it("never invents clinical content", () => {
    // Every word of output must come from the input or a fixed lexicon entry;
    // in particular a negation must survive intact.
    const r = standardize("No bleeding was observed.");
    expect(r.text).toContain("No bleeding");
  });

  it("handles empty and non-string input without throwing", () => {
    expect(standardize("").text).toBe("");
    expect(standardize(undefined as unknown as string).clean).toBe(true);
  });

  it("bounds a very large paste and stays fast", () => {
    // The INPUT is capped at 20k, which is what bounds the work. The OUTPUT can
    // legitimately be longer than its input slice — every "x-ray" becomes
    // "radiograph" — so the bound to assert is on what was read, not written.
    const huge = "The patient had an x-ray. ".repeat(5000); // ~130k chars
    const started = Date.now();
    const r = standardize(huge);
    expect(Date.now() - started).toBeLessThan(2000);
    // Truncated: far fewer than the 5000 occurrences that were pasted.
    const expansions = r.applied.find((a) => a.kind === "abbreviation")!.count;
    expect(expansions).toBeLessThan(1000);
    expect(r.text.length).toBeLessThan(60000);
  });

  it("is idempotent — standardizing twice changes nothing the second time", () => {
    const once = standardize("Took an x-ray of the abcess ");
    const twice = standardize(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.applied.filter((a) => a.kind !== "formatting")).toEqual([]);
  });
});

describe("standardize — presentation", () => {
  it("capitalizes the start of every sentence", () => {
    const r = standardize("pt had a radiograph. we drained it. she returns in a week");
    expect(r.text).toMatch(/^Patient/);
    expect(r.text).toContain(". We drained");
    expect(r.text).toContain(". She returns");
  });

  it("does not capitalize mid-sentence words", () => {
    expect(standardize("Composite on the mesial surface.").text).toContain("mesial");
  });

  it("separates a unit from its number", () => {
    expect(standardize("Prescribed 500mg.").text).toContain("500 mg");
    expect(standardize("Probing depth 4mm.").text).toContain("4 mm");
  });

  it("does not split a tooth designation or a plain number", () => {
    const r = standardize("Restored tooth 19 and tooth 3.");
    expect(r.text).toContain("tooth 19");
    expect(r.text).toContain("tooth 3");
  });

  it("stays idempotent after presentation changes", () => {
    const once = standardize("pt had a x-ray. gave 500mg");
    const twice = standardize(once.text);
    expect(twice.text).toBe(once.text);
  });
});

describe("standardize — shorthand: define on first use, then leave it", () => {
  it("expands the first occurrence and defines it parenthetically", () => {
    const r = standardize("RCT was started today.");
    // Sentence-initial, so the expansion is capitalized — the definition itself
    // must NOT be shouted just because the source was an all-caps initialism.
    expect(r.text).toBe("Root canal therapy (RCT) was started today.");
  });

  it("leaves later occurrences as the shorthand", () => {
    const r = standardize("RCT was started. The RCT was finished at visit two. RCT complete.");
    // Defined exactly once...
    expect(r.text.match(/root canal therapy \(RCT\)/gi)).toHaveLength(1);
    // ...and the other two stay short.
    expect(r.text.match(/\bRCT\b/g)!.length).toBe(3); // one inside the definition + two bare
  });

  it("does not re-define a term the writer already defined", () => {
    const already = "Scaling and root planing (SRP) was done. SRP again next visit.";
    const r = standardize(already);
    expect(r.text.match(/scaling and root planing \(SRP\)/gi)).toHaveLength(1);
  });

  it("expands a range of dental and medical shorthand", () => {
    const has = (input: string, want: string) =>
      expect(standardize(input).text.toLowerCase(), input).toContain(want.toLowerCase());
    has("BW taken.", "bitewing radiograph (BW)");
    has("Quadrant one SRP done.", "scaling and root planing (SRP)");
    has("BOP noted.", "bleeding on probing (BOP)");
    has("NKDA.", "no known drug allergies (NKDA)");
    has("Placed MTA.", "mineral trioxide aggregate (MTA)");
    has("IANB given.", "inferior alveolar nerve block (IANB)");
  });

  // Shorthand for an ORDINARY WORD is not a term of art and gets replaced
  // everywhere — "diagnosis (Dx)" would be absurd.
  it("replaces ordinary-word shorthand everywhere instead of defining it", () => {
    const r = standardize("Dx pulpitis. Tx started. Dx confirmed.");
    expect(r.text).not.toContain("(Dx)");
    expect(r.text.toLowerCase()).toContain("diagnosis");
    expect(r.text.toLowerCase()).toContain("treatment");
  });

  // The safety half. These have more than one real reading in a dental chart.
  it("NEVER guesses an ambiguous initialism", () => {
    for (const [input, short] of [
      ["GP point placed.", "GP"],
      ["CR restoration.", "CR"],
      ["ASA block given.", "ASA"],
      ["PD of 5 mm.", "PD"]
    ]) {
      const r = standardize(input);
      expect(r.text, input).toContain(short);
      expect(r.text, input).not.toMatch(/\(/); // no definition was written
      expect(r.flags.some((f) => f.kind === "ambiguous-shorthand"), input).toBe(true);
    }
  });

  // ISMP error-prone dosing abbreviations.
  it("expands unambiguous dosing frequencies but never qd or qod", () => {
    expect(standardize("Take bid.").text).toContain("twice daily (bid)");
    expect(standardize("Take tid.").text).toContain("three times daily (tid)");
    const qd = standardize("Take qd.");
    expect(qd.text).toContain("qd");
    expect(qd.text).not.toContain("(qd)");
    expect(qd.flags.some((f) => f.kind === "ambiguous-shorthand")).toBe(true);
  });

  it("stays idempotent across the shorthand pass", () => {
    const once = standardize("RCT and BW done. RCT again.");
    const twice = standardize(once.text);
    expect(twice.text).toBe(once.text);
  });
});

describe("standardize — oversize input is reported, never silently dropped", () => {
  it("flags truncation rather than quietly returning a shorter note", () => {
    const long = "Patient reports pain. ".repeat(1000); // ~22,000 chars
    const r = standardize(long);
    expect(r.truncated).toBe(true);
    const flag = r.flags.find((f) => f.kind === "truncated");
    expect(flag).toBeDefined();
    // It leads the list: losing content outranks every wording change.
    expect(r.flags[0].kind).toBe("truncated");
    expect(flag!.guidance).toContain("20,000");
  });

  it("does not claim truncation for input that fits", () => {
    const r = standardize("Composite placed on the mesial surface.");
    expect(r.truncated).toBe(false);
    expect(r.flags.some((f) => f.kind === "truncated")).toBe(false);
  });
});
