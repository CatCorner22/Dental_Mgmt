import { describe, expect, it } from "vitest";
import { OMISSION_LICENCES, exactLicence, licenceFor, licenceText, omissionReport } from "./omissions";
import { activeModules } from "@/lib/modules";
import { isFieldRequired, isFieldVisible } from "@/lib/schema/conditions";
import { fieldKey, type NoteState } from "@/lib/schema/types";

// The escape hatch, made countable.
//
// Two things have to stay true at once and they pull against each other: the escape
// must remain available, because a form that refuses "I do not know" gets a
// fabricated value instead; and it must stop being invisible, because clicking "not
// applicable" is one action and finding out the real answer is a conversation.

const modules = activeModules([]);

/** Fill every required visible text-ish field with the same answer. */
function noteWhereEverythingIs(answer: string): NoteState {
  const note: NoteState = { selectedModuleIds: [], values: {} };
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (!isFieldVisible(field, mod.id, note)) continue;
        if (!isFieldRequired(field, mod.id, note)) continue;
        if (field.type === "text" || field.type === "textarea") {
          note.values[fieldKey(mod.id, field.id)] = { kind: "text", value: answer };
        }
      }
    }
  }
  return note;
}

describe("which licence a value invokes", () => {
  it("recognises each one", () => {
    expect(licenceFor("Not applicable.")?.id).toBe("not-applicable");
    expect(licenceFor("N/A")?.id).toBe("not-applicable");
    expect(licenceFor("Not assessed at this visit.")?.id).toBe("not-assessed");
    expect(licenceFor("Not reviewed at this visit.")?.id).toBe("not-reviewed");
    expect(licenceFor("Unknown — the patient could not say.")?.id).toBe("unknown");
    expect(licenceFor("Unresolved, carried to the next visit.")?.id).toBe("unresolved");
  });

  it("does not treat a real answer as a licence", () => {
    // The test that decides whether the rate means anything. A clinical sentence
    // that merely CONTAINS a negation is an answer, not an absence.
    for (const real of [
      "Generalized mild plaque with no acute findings.",
      "No known allergies of any kind.",
      "The patient reports no pain on biting.",
      "Probing depths 3 to 5 mm.",
      "Reviewed brushing and flossing technique."
    ]) {
      expect(licenceFor(real), real).toBeNull();
    }
  });

  it("keeps the licences distinct, because they claim different things", () => {
    // "Not applicable" says the question does not arise; "unknown" says someone
    // looked and could not find out. A reader who cannot tell them apart has learned
    // nothing from either.
    const means = new Set(OMISSION_LICENCES.map((l) => l.means));
    expect(means.size).toBe(OMISSION_LICENCES.length);
    for (const l of OMISSION_LICENCES) expect(l.means.length).toBeGreaterThan(20);
  });
});

describe("the one-click licence chips", () => {
  // These back a control that OVERWRITES a required field. The tests that matter
  // are the ones about what it must refuse to touch.

  it("writes a sentence, not a UI label", () => {
    // A one-click licence has to be indistinguishable in the record from a typed
    // one, or the note reads as though the tool answered for the clinician.
    for (const l of OMISSION_LICENCES) {
      const written = licenceText(l);
      expect(written[0]).toBe(written[0].toUpperCase());
      expect(written.endsWith(".")).toBe(true);
      // Still countable: what the chip writes is what the audit recognises.
      expect(licenceFor(written)?.id).toBe(l.id);
    }
  });

  it("round-trips its own output, so the chip shows as pressed after a click", () => {
    for (const l of OMISSION_LICENCES) {
      expect(exactLicence(licenceText(l))?.id).toBe(l.id);
    }
  });

  it("recognises a hand-typed licence in any casing or punctuation", () => {
    expect(exactLicence("not applicable")?.id).toBe("not-applicable");
    expect(exactLicence("  Not Applicable.  ")?.id).toBe("not-applicable");
    expect(exactLicence("UNKNOWN")?.id).toBe("unknown");
  });

  it("refuses prose that merely CONTAINS a licence — the safety property", () => {
    // The whole reason exactLicence is stricter than licenceFor. Each of these
    // invokes a licence and is also a real clinical sentence; a chip row that
    // treated them as licences would be one click from deleting the writer's
    // account of what happened.
    for (const prose of [
      "Radiograph not reviewed at this visit because the sensor failed.",
      "Unknown allergy history — patient to bring their list next visit.",
      "Not applicable to the upper arch; lower arch charted below.",
      "Pending the specialist's report, which the patient will forward."
    ]) {
      expect(licenceFor(prose), `licenceFor should still count: ${prose}`).not.toBeNull();
      expect(exactLicence(prose), `exactLicence must refuse: ${prose}`).toBeNull();
    }
  });

  it("treats an empty or whitespace field as no licence", () => {
    for (const empty of ["", "   ", "\n\t "]) expect(exactLicence(empty)).toBeNull();
  });
});

describe("what the report counts", () => {
  it("counts a note answered entirely with licences", () => {
    const r = omissionReport(noteWhereEverythingIs("Not applicable."), modules);
    expect(r.licensed).toBeGreaterThan(0);
    expect(r.answered).toBe(0);
    expect(r.rate).toBe(1);
    expect(r.byLicence[0].licence.id).toBe("not-applicable");
    // Named fields, not just a number: the writer needs to see WHERE.
    expect(r.byLicence[0].fields.length).toBe(r.licensed);
  });

  it("counts a note answered with real facts as zero", () => {
    const r = omissionReport(
      noteWhereEverythingIs("Generalized mild plaque with no acute findings noted."),
      modules
    );
    expect(r.licensed).toBe(0);
    expect(r.rate).toBe(0);
    expect(r.byLicence).toEqual([]);
  });

  it("ignores empty required fields on both sides of the rate", () => {
    // An unfilled required field is already an S1 that blocks filing. Counting it
    // here would make the rate say something about incompleteness rather than about
    // substitution, and then it would mean two things and be used for neither.
    const empty = omissionReport({ selectedModuleIds: [], values: {} }, modules);
    expect(empty.answered).toBe(0);
    expect(empty.licensed).toBe(0);
    expect(empty.rate).toBe(0);
  });

  it("ignores an optional field's licence", () => {
    // A licence in a field nobody demanded is a writer being helpfully explicit,
    // not a shortcut. Counting it would bury the signal in noise.
    const note: NoteState = { selectedModuleIds: [], values: {} };
    let optional = 0;
    for (const mod of modules) {
      for (const section of mod.sections) {
        for (const field of section.fields) {
          if (isFieldRequired(field, mod.id, note)) continue;
          if (field.type !== "text" && field.type !== "textarea") continue;
          note.values[fieldKey(mod.id, field.id)] = { kind: "text", value: "Not applicable." };
          optional++;
        }
      }
    }
    expect(optional).toBeGreaterThan(0);
    expect(omissionReport(note, modules).licensed).toBe(0);
  });

  it("ranks by how often each licence was used, with a stable tiebreak", () => {
    const note = noteWhereEverythingIs("Not applicable.");
    // Flip a couple to a different licence.
    const keys = Object.keys(note.values).slice(0, 2);
    for (const k of keys) note.values[k] = { kind: "text", value: "Unknown." };
    const r = omissionReport(note, modules);
    expect(r.byLicence[0].licence.id).toBe("not-applicable");
    expect(r.byLicence.map((b) => b.licence.id)).toContain("unknown");
  });
});

describe("it never blocks", () => {
  it("reports and nothing else", () => {
    // The escape hatch has to remain available. A threshold that blocked filing
    // would teach staff to type a plausible-sounding fact instead, which is the
    // exact harm the escape exists to prevent. The report has no gate in it, and
    // this test exists so adding one is a visible decision.
    const r = omissionReport(noteWhereEverythingIs("Not applicable."), modules);
    expect(Object.keys(r).sort()).toEqual(["answered", "byLicence", "licensed", "rate"]);
  });
});
