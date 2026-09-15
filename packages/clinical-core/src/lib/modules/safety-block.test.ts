import { describe, expect, it } from "vitest";
import { universalCore } from "./universal-core";
import { isFieldRequired, isFieldVisible } from "@/lib/schema/conditions";
import type { Field, NoteState } from "@/lib/schema/types";
import { NKA, NKDA, NO_MEDICATIONS, PREMED_NOT_REQUIRED } from "./shared";

// The safety block: the handful of fields where "nothing to report" is the
// dangerous answer rather than the empty one.
//
// A blank allergy box means "we do not know". "No known drug allergies" means
// somebody asked and the answer was none — an affirmative clinical claim, and
// the one a later reader leans on before prescribing. A form that lets the
// second happen by default manufactures it.

const section = universalCore.sections.find((s) => s.id === "history-review")!;
const field = (id: string): Field => section.fields.find((f) => f.id === id)!;

function stateWith(values: Record<string, string>): NoteState {
  return {
    selectedModuleIds: ["universal-core"],
    values: Object.fromEntries(
      Object.entries(values).map(([k, v]) => [`universal-core.${k}`, { kind: "select", value: v }])
    )
  };
}

describe("safety block — a negative must be confirmed, never assumed", () => {
  it.each([
    ["allergies-status", "allergies-confirm", NKA],
    ["allergies-status", "allergies-confirm", NKDA],
    ["medications-status", "medications-confirm", NO_MEDICATIONS],
    ["premedication-status", "premedication-confirm", PREMED_NOT_REQUIRED]
  ])("%s = a negative makes %s appear AND be required", (statusId, confirmId, negative) => {
    const state = stateWith({ [statusId]: negative });
    expect(isFieldVisible(field(confirmId), "universal-core", state)).toBe(true);
    expect(isFieldRequired(field(confirmId), "universal-core", state)).toBe(true);
  });

  it.each([
    ["allergies-status", "allergies-confirm", "Allergies on file; see the allergy list in the clinical system."],
    ["medications-status", "medications-confirm", "Medication list not reviewed at this visit."],
    ["premedication-status", "premedication-confirm", "Required; taken before the appointment as directed."]
  ])("%s = a non-negative hides %s and does not require it", (statusId, confirmId, other) => {
    const state = stateWith({ [statusId]: other });
    expect(isFieldVisible(field(confirmId), "universal-core", state)).toBe(false);
    // A hidden field is never required — otherwise the note could not be filed.
    expect(isFieldRequired(field(confirmId), "universal-core", state)).toBe(false);
  });

  // The whole reason the allergy field was split apart. The transformer used to
  // rewrite a charted "NKA" into "no known drug allergies", silently narrowing
  // an all-classes statement to a drugs-only one. The form must not blur what
  // the transformer is now forbidden to guess.
  it("keeps NKA and NKDA as distinct, separately selectable statements", () => {
    const values = field("allergies-status").type === "select"
      ? (field("allergies-status") as { options: { value: string }[] }).options.map((o) => o.value)
      : [];
    expect(values).toContain(NKA);
    expect(values).toContain(NKDA);
    expect(NKA).not.toEqual(NKDA);
    // NKDA must say out loud what it does not cover.
    expect(NKDA.toLowerCase()).toContain("not excluded");
    // And there must be an honest "we did not ask" option, so that a rushed
    // visit records ignorance rather than a false negative.
    expect(values.some((v) => /not reviewed/i.test(v))).toBe(true);
  });

  it("offers a carried-forward answer, not just a yes", () => {
    const confirm = field("allergies-confirm") as { options: { value: string }[] };
    // "Did you confirm?" as a yes/no is a box everyone ticks. The distinction
    // that carries information is what the confirmation RESTS on — and a
    // negative carried forward unasked is the specific failure that puts a
    // stale "no allergies" in front of a prescriber.
    expect(confirm.options.some((o) => /carried forward/i.test(o.value))).toBe(true);
    expect(confirm.options.some((o) => /checked against the chart/i.test(o.value))).toBe(true);
  });

  it("every status field is required, so none can be left silently blank", () => {
    const empty = stateWith({});
    for (const id of [
      "history-changes-status",
      "allergies-status",
      "medications-status",
      "premedication-status"
    ]) {
      expect(isFieldRequired(field(id), "universal-core", empty), id).toBe(true);
    }
  });
});
