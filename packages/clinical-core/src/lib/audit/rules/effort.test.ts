import { describe, expect, it } from "vitest";
import { runEffortRules, runGibberishRule, runProfessionalToneRule } from "./effort";

describe("gibberish", () => {
  it.each(["asdf asdf", "Patient aaaaaaaa", "test test test", "blah blah notes", "zzz"])(
    "stops filler: %s",
    (input) => {
      const f = runGibberishRule(input);
      expect(f).toHaveLength(1);
      expect(f[0].severity).toBe("S1");
      expect(f[0].message).toMatch(/reader|documentation/i);
    }
  );

  it("raises one finding, not one per pattern — a block is a message, not a nag", () => {
    expect(runGibberishRule("asdf qwer zxcv aaaaaaa")).toHaveLength(1);
  });

  it("leaves real clinical text alone", () => {
    for (const ok of [
      "Patient tolerated the procedure. Assessed teeth 2, 3, and 14.",
      "Attested by Dr. Assad.", // 'ssa' inside a name must not trip a mash pattern
      "Occlusal assessment completed."
    ]) {
      expect(runGibberishRule(ok), ok).toHaveLength(0);
    }
  });
});

describe("professional tone", () => {
  it.each([
    ["Patient was being dramatic about the injection.", "dramatic"],
    ["This crazy patient refused again.", "crazy"],
    ["Patient is lying about flossing.", "lying"]
  ])("stops unprofessional wording: %s", (input, token) => {
    const f = runProfessionalToneRule(input);
    expect(f.length).toBeGreaterThan(0);
    expect(f[0].matchedText?.toLowerCase()).toBe(token);
    expect(f[0].severity).toBe("S1");
    expect(f[0].suggestion).toMatch(/observable|finding/i);
  });

  it("does not fire on clinical uses", () => {
    // This assertion used to run the other way: it pinned that "fat pad graft
    // site" DID fire, on the reasoning that the fix was to write "buccal fat
    // pad" instead. The precision corpus made the cost visible — the buccal fat
    // pad is an anatomical structure, "gross debridement" is the literal ADA
    // D4355 description, and a patient is "lying supine" — and every one of
    // those blocked a correct note at S1, which blocks email.
    //
    // A rule that stops a clinician writing correct anatomy does not teach them
    // to write better; it teaches them the panel is wrong. So the rule now reads
    // the words either side, and this test pins BOTH directions, because a
    // suppression that swallows the real thing is the worse failure.
    for (const clinical of [
      "Reviewed the buccal fat pad graft site.",
      "Full mouth gross debridement completed.",
      "Gross calculus on the lingual surfaces.",
      "Patient positioned lying supine.",
      "The radiolucency lies distal to tooth 14."
    ]) {
      expect(runProfessionalToneRule(clinical), clinical).toHaveLength(0);
    }

    // Still caught — the slur is the point of the rule and survives the gate.
    for (const rude of [
      "Patient is fat and will not floss.",
      "Patient was disgusting.",
      "Patient is lying about flossing."
    ]) {
      expect(runProfessionalToneRule(rude).length, rude).toBeGreaterThan(0);
    }

    // And a note containing both still reports: the legitimate phrase must not
    // excuse the slur sitting beside it.
    expect(
      runProfessionalToneRule("Gross debridement completed. Patient was disgusting about it.")
        .length
    ).toBeGreaterThan(0);
  });

  it("cold logic, zero condescension: the message names the reader's problem", () => {
    const f = runEffortRules("Patient was hysterical.");
    expect(f[0].message).toMatch(/documents the visit|jury/i);
    expect(f[0].message).not.toMatch(/you should|please try|be professional/i);
  });
});
