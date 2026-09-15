import { describe, expect, it } from "vitest";

import { partitionIntoSoap, SOAP_SECTIONS, structureIntoSoap } from "./structure";

// partitionIntoSoap is what the note builder's paste intake reads, so its
// contract has to be exactly as tight as structureIntoSoap's: it MOVES
// sentences. No rewording, no merging, no splitting, no dropping, nothing
// added. structure.test.ts asserts that for the joined string; this asserts it
// for the list, because the two share a splitter and it would be easy for the
// list form to quietly gain or lose a sentence at a section boundary.

const NOTE = [
  "The patient reports cold sensitivity on the upper left for two weeks.",
  "No known drug allergies.",
  "Probing depths are generalized 2 to 3 millimetres with no bleeding on probing.",
  "Diagnosis: reversible pulpitis on the upper left first molar.",
  "Plan: place a sedative restoration and review in three weeks."
].join(" ");

const allSentences = (input: string) =>
  partitionIntoSoap(input).flatMap((p) => p.sentences);

describe("partitionIntoSoap", () => {
  it("returns every sentence exactly once, byte-identical", () => {
    // The MULTISET is the invariant, not the order: partitions come back in
    // canonical section order, so flattening them deliberately does not
    // reproduce the order the sentences were typed in. What may never change is
    // the sentences themselves — none reworded, none merged, none split, none
    // dropped, none invented.
    const out = allSentences(NOTE);
    const sentences = NOTE.match(/[^.]+\./g)!.map((s) => s.trim());
    expect([...out].sort()).toEqual([...sentences].sort());
    expect(new Set(out).size).toBe(out.length);
    // And every one of them is present verbatim in the source.
    for (const s of out) expect(NOTE).toContain(s);
  });

  it("splits a note across more than one section", () => {
    const parts = partitionIntoSoap(NOTE);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.sentences.length).toBeGreaterThan(0);
      expect(p.text).toBe(p.sentences.join(" "));
    }
  });

  it("keeps sections in canonical order however the note was written", () => {
    // A reader expects Safety before Subjective before Objective, whatever
    // order the writer happened to type them in.
    const backwards = [
      "Plan: review in three weeks.",
      "Diagnosis: reversible pulpitis.",
      "Probing depths are 2 to 3 millimetres.",
      "The patient reports cold sensitivity."
    ].join(" ");
    const order = partitionIntoSoap(backwards).map((p) => p.section);
    const canonical = SOAP_SECTIONS.filter((s) => order.includes(s));
    expect(order).toEqual(canonical);
  });

  it("names Safety as its own partition rather than folding it into Objective", () => {
    // Safety is the partition with the most at stake and the one a note is
    // most likely to bury. It has to come back separately or the intake cannot
    // offer it its own destination.
    const parts = partitionIntoSoap(NOTE);
    const safety = parts.find((p) => p.section === "Safety");
    expect(safety?.text).toContain("No known drug allergies.");
  });

  it("declines on a note too short to sort", () => {
    // Two sentences under five headings reads worse than the two sentences did.
    expect(partitionIntoSoap("The patient reports pain. Reviewed in two weeks.")).toEqual([]);
  });

  it("declines when everything lands in one section", () => {
    // There is no structure to add, only ceremony around the note it already was.
    const oneNote = [
      "The patient reports pain on the upper left.",
      "The patient reports the pain wakes them at night.",
      "The patient reports paracetamol helps a little."
    ].join(" ");
    expect(partitionIntoSoap(oneNote)).toEqual([]);
  });

  it("declines on a note that is already sectioned", () => {
    const already = "Subjective\nThe patient reports pain.\n\nPlan\nReview in three weeks.";
    expect(partitionIntoSoap(already)).toEqual([]);
  });

  it("declines on empty and whitespace input", () => {
    expect(partitionIntoSoap("")).toEqual([]);
    expect(partitionIntoSoap("   \n\t ")).toEqual([]);
  });

  it("agrees with structureIntoSoap about which sections were used", () => {
    // The two share a bucketing pass. If they ever disagree, one of them is
    // reading a different note than the writer was shown.
    const structured = structureIntoSoap(NOTE);
    expect(partitionIntoSoap(NOTE).map((p) => p.section)).toEqual(structured.sections);
  });

  it("agrees with structureIntoSoap about declining", () => {
    const short = "The patient reports pain. Reviewed.";
    expect(structureIntoSoap(short).declined).toBe(true);
    expect(partitionIntoSoap(short)).toEqual([]);
  });
});
