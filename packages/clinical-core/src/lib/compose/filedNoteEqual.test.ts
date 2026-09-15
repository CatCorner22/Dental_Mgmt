import { describe, expect, it } from "vitest";
import { filedNoteEqual } from "./filedNoteEqual";
import type { NoteState } from "@/lib/schema/types";

const base = (values: NoteState["values"]): NoteState => ({
  selectedModuleIds: ["sedation-anesthesia"],
  values
});

describe("filedNoteEqual", () => {
  // The bug the composed-output comparator exists for: the picker appends on
  // re-check, so toggling a chip off and on reorders the array — but the
  // composer emits multiselect values in canonical option order, so the FILED
  // note is byte-identical. A raw-state compare would call this "changed" and
  // re-open the submit gate, letting a duplicate ticket be filed.
  it("treats a re-ordered multiselect as equal (composer canonicalizes order)", () => {
    const a = base({ "sedation-anesthesia.route": { kind: "multiselect", values: ["enteral", "intravenous"] } });
    const b = base({ "sedation-anesthesia.route": { kind: "multiselect", values: ["intravenous", "enteral"] } });
    expect(filedNoteEqual(a, b)).toBe(true);
  });

  it("treats trailing whitespace in text as equal (composer trims)", () => {
    const a = base({ "sedation-anesthesia.fitness": { kind: "text", value: "ASA II" } });
    const b = base({ "sedation-anesthesia.fitness": { kind: "text", value: "ASA II   " } });
    expect(filedNoteEqual(a, b)).toBe(true);
  });

  it("sees a genuine value change as different", () => {
    const a = base({ "sedation-anesthesia.route": { kind: "multiselect", values: ["enteral"] } });
    const b = base({ "sedation-anesthesia.route": { kind: "multiselect", values: ["inhalation"] } });
    expect(filedNoteEqual(a, b)).toBe(false);
  });

  it("sees a real text edit as different", () => {
    const a = base({ "sedation-anesthesia.fitness": { kind: "text", value: "ASA II" } });
    const b = base({ "sedation-anesthesia.fitness": { kind: "text", value: "ASA III" } });
    expect(filedNoteEqual(a, b)).toBe(false);
  });

  // A module added WITHOUT any values composes to nothing, so the filed record
  // is unchanged and the notes are equal — that is correct (re-opening the gate
  // for an output-identical change would be the bug). A module change only
  // counts when it actually changes composed output.
  it("ignores an empty added module but sees one that changes output", () => {
    const a = base({});
    const emptyAdd: NoteState = { selectedModuleIds: ["sedation-anesthesia", "extraction"], values: {} };
    expect(filedNoteEqual(a, emptyAdd)).toBe(true);

    const withValue: NoteState = {
      selectedModuleIds: ["sedation-anesthesia", "extraction"],
      values: { "sedation-anesthesia.fitness": { kind: "text", value: "ASA II" } }
    };
    expect(filedNoteEqual(a, withValue)).toBe(false);
  });
});
