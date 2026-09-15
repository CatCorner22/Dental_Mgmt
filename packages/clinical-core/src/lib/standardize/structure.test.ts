import { describe, expect, it } from "vitest";
import { splitSentences, structureIntoSoap, SOAP_SECTIONS } from "./structure";
import { standardize } from "./standardize";
import { verifyMeaning } from "@/lib/verify/verifyMeaning";

// DETERMINISTIC SOAP STRUCTURING, adversarially.
//
// This pass MOVES SENTENCES. That is a bigger claim than substituting a word, and
// on a legal record it needs a harder guarantee than "it looked right in a demo".
// The guarantee is: every sentence of the input appears in the output exactly once
// and byte-identical, nothing is reworded, merged, split or dropped, and the only
// text added is the section headings.
//
// So the first group below is not a feature test. It is the invariant, asserted on
// every case in this file including the hostile ones, because a partition of a list
// is only safe if it is really a partition.

/** The invariant, as a function, so every test can call it. */
function assertNothingLostOrChanged(input: string) {
  const r = structureIntoSoap(input);
  if (r.declined || r.alreadyStructured) return r;
  const inputSentences = splitSentences(input.trim());
  const bodyLines = r.text
    .split("\n")
    .filter((l) => l.trim() && !SOAP_SECTIONS.includes(l.trim() as never));
  const outputSentences = splitSentences(bodyLines.join(" "));
  // Multiset equality: order changes on purpose, content may not.
  expect([...outputSentences].sort(), `sentences changed\nIN : ${input}\nOUT: ${r.text}`).toEqual(
    [...inputSentences].sort()
  );
  return r;
}

const NOTE =
  "Recall patient. Patient reports sensitivity on the lower right for 3 days. " +
  "No changes to medical history. NKA. Blood pressure 118/76. " +
  "Probing depths 3 to 5 mm with bleeding on probing. Bitewing radiographs taken, no new caries. " +
  "Prophylaxis completed. Diagnosis: generalized gingivitis. " +
  "Oral hygiene instructions given. Reappoint in 6 months.";

describe("the invariant: a partition, not a rewrite", () => {
  it("keeps every sentence exactly once on a realistic note", () => {
    const r = assertNothingLostOrChanged(NOTE);
    expect(r.declined).toBe(false);
    expect(r.sections.length).toBeGreaterThan(2);
  });

  it("adds no text except the headings", () => {
    const r = structureIntoSoap(NOTE);
    const added = r.text
      .split("\n")
      .filter((l) => l.trim() && SOAP_SECTIONS.includes(l.trim() as never));
    expect(added.length).toBe(r.sections.length);
  });

  it("emits sections in canonical order", () => {
    const r = structureIntoSoap(NOTE);
    const order = r.sections.map((s) => SOAP_SECTIONS.indexOf(s));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("omits a section that has no content", () => {
    // No diagnosis in this note, so no Assessment heading. An empty heading is a
    // placeholder, and a placeholder in a clinical record reads as a finding of
    // nothing rather than as an absence of input.
    const noDiagnosis =
      "Patient reports sensitivity on the lower right. NKA. " +
      "Probing depths 3 mm. Reappoint in 6 months.";
    const r = structureIntoSoap(noDiagnosis);
    expect(r.sections).not.toContain("Assessment");
    expect(r.text).not.toMatch(/^Assessment$/m);
  });

  it("passes the meaning verifier, which is the independent check", () => {
    // The verifier's value checks are order-independent by design ("a restructure
    // moves sentences"), so a structured note must survive them. If this fails, the
    // pass changed something it claims not to touch.
    const r = structureIntoSoap(NOTE);
    const verdict = verifyMeaning(NOTE, r.text.replace(/^(?:Safety|Subjective|Objective|Assessment|Plan)$/gm, ""), {
      mode: "rewrite"
    });
    expect(verdict.rejections.map((x) => `${x.code}: ${x.detail}`).join("\n")).toBe("");
  });
});

describe("where sentences actually land", () => {
  const r = structureIntoSoap(NOTE);
  const sectionOf = (fragment: string) => {
    const lines = r.text.split("\n");
    let current = "";
    for (const line of lines) {
      if (SOAP_SECTIONS.includes(line.trim() as never)) current = line.trim();
      else if (line.includes(fragment)) return current;
    }
    return "none";
  };

  it("files an allergy statement under Safety, not Objective", () => {
    // A safety sentence filed under Objective is a safety sentence a reader skims
    // past, which is why Safety wins a tie.
    expect(sectionOf("NKA")).toBe("Safety");
  });

  it("files what the patient said under Subjective", () => {
    expect(sectionOf("Patient reports sensitivity")).toBe("Subjective");
  });

  it("files measurements and imaging under Objective", () => {
    expect(sectionOf("Probing depths")).toBe("Objective");
    expect(sectionOf("Bitewing radiographs")).toBe("Objective");
  });

  it("files a labelled diagnosis under Assessment", () => {
    expect(sectionOf("generalized gingivitis")).toBe("Assessment");
  });

  it("files instructions and follow-up under Plan", () => {
    expect(sectionOf("Reappoint in 6 months")).toBe("Plan");
  });

  it("lets an explicit label outrank ordinary cues", () => {
    // "Diagnosis: the radiograph shows periapical radiolucency" is full of Objective
    // cues and is still an assessment, because the writer said so.
    const out = structureIntoSoap(
      "Patient reports pain. Diagnosis: the radiograph shows a periapical radiolucency. Reappoint in 2 weeks."
    );
    const lines = out.text.split("\n");
    const i = lines.findIndex((l) => l.includes("periapical radiolucency"));
    const heading = [...lines.slice(0, i)].reverse().find((l) => SOAP_SECTIONS.includes(l.trim() as never));
    expect(heading?.trim()).toBe("Assessment");
  });
});

describe("it declines rather than guessing", () => {
  it("leaves a two-sentence note alone", () => {
    // Two lines under five headings reads worse than the two lines did.
    const r = structureIntoSoap("Prophylaxis completed. Reappoint in 6 months.");
    expect(r.declined).toBe(true);
    expect(r.text).toBe("Prophylaxis completed. Reappoint in 6 months.");
  });

  it("leaves a note alone when everything lands in one section", () => {
    const r = structureIntoSoap(
      "Probing depths 3 mm. Bitewing radiographs taken. Calculus removed from the lower anterior teeth."
    );
    expect(r.declined).toBe(true);
  });

  it("leaves an already-sectioned note completely alone", () => {
    // Idempotency, and the reason it matters: running this twice must not nest
    // headings inside headings.
    const once = structureIntoSoap(NOTE);
    const twice = structureIntoSoap(once.text);
    expect(twice.alreadyStructured).toBe(true);
    expect(twice.text).toBe(once.text);
  });

  it("is idempotent three deep", () => {
    const a = structureIntoSoap(NOTE).text;
    const b = structureIntoSoap(a).text;
    const c = structureIntoSoap(b).text;
    expect(b).toBe(a);
    expect(c).toBe(a);
  });
});

describe("hostile input", () => {
  it("does not split a dotted abbreviation into two sentences", () => {
    // "Chlorhexidine b.i.d. for two weeks" is ONE instruction. Splitting at the
    // abbreviation's period would file half a prescription in a different section.
    expect(splitSentences("Rinse chlorhexidine b.i.d. for two weeks.")).toEqual([
      "Rinse chlorhexidine b.i.d. for two weeks."
    ]);
    expect(splitSentences("Ibuprofen 600 mg p.r.n. pain.")).toEqual(["Ibuprofen 600 mg p.r.n. pain."]);
  });

  it("does not split after an honorific", () => {
    expect(splitSentences("Referred to Dr. Alvarez for evaluation.")).toEqual([
      "Referred to Dr. Alvarez for evaluation."
    ]);
  });

  it("survives a note with no terminal punctuation at all", () => {
    assertNothingLostOrChanged(
      "recall patient no changes to medical history NKA probing depths 3 mm reappoint 6 months"
    );
  });

  it("survives a wall of one-word sentences", () => {
    assertNothingLostOrChanged("Recall. NKA. Prophylaxis. Radiographs. Reappoint. Monitor. Referred.");
  });

  it("survives text with no clinical content whatsoever", () => {
    const r = structureIntoSoap("aaa. bbb. ccc. ddd.");
    // Everything inherits into one section, so it declines rather than inventing
    // a shape for something it cannot read.
    expect(r.declined).toBe(true);
    expect(r.text).toBe("aaa. bbb. ccc. ddd.");
  });

  it("survives an empty string and whitespace", () => {
    expect(structureIntoSoap("").text).toBe("");
    expect(structureIntoSoap("   \n  ").declined).toBe(true);
  });

  it("does not hang or blow up on a very long note", () => {
    const long =
      "Patient reports pain. NKA. Probing depths 3 mm. Diagnosis: gingivitis. Reappoint in 6 months. ".repeat(
        400
      );
    const start = performance.now();
    const r = structureIntoSoap(long);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(r.sections.length).toBe(5);
  });

  it("keeps a sentence containing every section's cues in exactly one place", () => {
    // The adversarial classification case: one sentence that matches everything.
    // It must be filed once, not copied into five sections.
    const mixed =
      "Patient reports that the allergy list, the probing depths, the diagnosis and the plan were all reviewed. " +
      "Prophylaxis completed. Reappoint in 6 months.";
    const r = assertNothingLostOrChanged(mixed);
    const occurrences = r.text.split("the allergy list").length - 1;
    expect(occurrences).toBe(1);
  });

  it("never loses a negation to the reordering", () => {
    // The failure that would matter most: a denial filed away from what it denies,
    // or lost altogether.
    const withDenials =
      "Patient denies pain, swelling and fever. NKA. Probing depths 3 mm with no bleeding on probing. " +
      "No new caries on the bitewing radiographs. Reappoint in 6 months.";
    const r = assertNothingLostOrChanged(withDenials);
    const negations = (s: string) => (s.match(/\b(?:no|denies|denied|without)\b/gi) ?? []).length;
    expect(negations(r.text)).toBe(negations(withDenials));
  });
});

describe("it composes with the vocabulary pass", () => {
  it("structures a note the standardizer just cleaned", () => {
    // The real workflow: type shorthand, standardize, then structure.
    const shorthand =
      "recall pt. pt c/o sensitivity lr x3 days. no changes to mh. nka. bp 118/76. " +
      "pd 3-5mm w/ bop. bwx taken, no new caries. prophy completed. dx generalized gingivitis. " +
      "ohi given. reappoint 6mo.";
    const cleaned = standardize(shorthand).text;
    const r = assertNothingLostOrChanged(cleaned);
    expect(r.declined).toBe(false);
    // The whole point: a reader gets sections, from shorthand, with no model.
    expect(r.sections).toContain("Safety");
    expect(r.sections).toContain("Plan");
  });
});
