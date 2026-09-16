import { describe, expect, it } from "vitest";
import { MODULES_BY_ID, activeModules } from "./index";
import { ITEM_OPEN, NOTHING_OPEN } from "./shared";
import { runRequiredRule } from "@/lib/audit/rules/required";
import { composeNote } from "@/lib/compose/composeNote";
import type { NoteState } from "@/lib/schema/types";

const CORE = activeModules([]);

function note(values: NoteState["values"] = {}): NoteState {
  return { selectedModuleIds: [], values };
}

function missingFieldIds(state: NoteState): string[] {
  return runRequiredRule(state, CORE)
    .map((f) => f.fieldRef?.fieldId ?? "")
    .sort();
}

// The required set an EMPTY note has always produced. Every field added to
// universal-core has to leave this list exactly as it is: a new plainly
// required field would put a REQUIRED finding on every draft already saved,
// which blocks email on notes nobody has touched.
const ALWAYS_REQUIRED = [
  "allergies-status",
  "complication-status",
  "diagnosis",
  "diagnosis-status",
  "encounter-type",
  "history-changes-status",
  "history-reviewed",
  "medications-status",
  "patient-decision",
  "premedication-status",
  "procedure-status",
  "recommended-care",
  "visit-purpose"
].sort();

describe("nothing new is required of a note that does not use it", () => {
  it("an untouched note asks for exactly the fields it always asked for", () => {
    expect(missingFieldIds(note())).toEqual(ALWAYS_REQUIRED);
  });

  it("saying nothing is open closes the block without opening four more boxes", () => {
    expect(missingFieldIds(note({ "universal-core.open-item": { kind: "select", value: NOTHING_OPEN } })))
      .toEqual(ALWAYS_REQUIRED);
  });

  it("omits both new sections from the note when they are unused", () => {
    const composed = composeNote(note(), CORE);
    expect(composed).not.toContain("Open items");
    expect(composed).not.toContain("Written for the patient");
  });
});

describe("an open item has to say who, by when, and where it is tracked", () => {
  const opened = note({ "universal-core.open-item": { kind: "select", value: ITEM_OPEN } });

  it("requires all four once the gate is set", () => {
    const missing = missingFieldIds(opened);
    for (const id of [
      "open-item-what",
      "open-item-owner",
      "open-item-due",
      "open-item-tracking"
    ]) {
      expect(missing, `${id} should be required once an item is open`).toContain(id);
    }
  });

  it("offers roles rather than a name box, and intervals rather than a date box", () => {
    // The poka-yoke. A free-text owner collects staff names and a free-text due
    // date collects "8/14", which the privacy rule stops at S0. Making the safe
    // answer the only answer beats catching the unsafe one afterwards.
    const core = MODULES_BY_ID.get("universal-core")!;
    const fields = core.sections.flatMap((s) => s.fields);
    for (const id of ["open-item-owner", "open-item-due", "open-item-tracking"]) {
      expect(fields.find((f) => f.id === id)?.type, id).toBe("select");
    }
  });

  it("keeps an honest answer available for where it is tracked", () => {
    const core = MODULES_BY_ID.get("universal-core")!;
    const field = core.sections
      .flatMap((s) => s.fields)
      .find((f) => f.id === "open-item-tracking");
    const values = field?.type === "select" ? field.options.map((o) => o.value) : [];
    expect(values).toContain("not yet tracked anywhere");
  });

  it("composes the block only when something is open", () => {
    expect(composeNote(opened, CORE)).toContain("Open items");
  });
});

describe("a summary written for the patient has to reach the patient", () => {
  it("requires the delivery answer once a summary exists", () => {
    const withSummary = note({
      "universal-core.patient-summary": {
        kind: "text",
        value: "We cleaned your teeth and everything looked healthy."
      }
    });
    expect(missingFieldIds(withSummary)).toContain("patient-summary-delivery");
  });

  it("asks for nothing when there is no summary", () => {
    expect(missingFieldIds(note())).not.toContain("patient-summary-delivery");
  });

  it("composes under its own heading, which is where the voice changes", () => {
    const composed = composeNote(
      note({
        "universal-core.patient-summary": {
          kind: "text",
          value: "We cleaned your teeth and everything looked healthy."
        }
      }),
      CORE
    );
    expect(composed).toContain("### Written for the patient");
  });

  it("marks the summary as patient-voice and leaves every other field alone", () => {
    const core = MODULES_BY_ID.get("universal-core")!;
    const marked = core.sections
      .flatMap((s) => s.fields)
      .filter((f) => f.audience === "patient")
      .map((f) => f.id);
    expect(marked).toEqual(["patient-summary"]);
  });
});

describe("a phone call is not a teledentistry encounter", () => {
  // Tennessee Rule 0460-01-.19: secure video or store-and-forward only, and it
  // says in terms that audio-only does not qualify. The encounter-type list had
  // nine in-office options and "teledentistry encounter", so a phone call had
  // to be filed as one or the other — a false statement about a regulated
  // category, made by the form rather than by the person writing the note.
  const core = MODULES_BY_ID.get("universal-core")!;
  const encounterType = core.sections
    .flatMap((s) => s.fields)
    .find((f) => f.id === "encounter-type");
  const values = encounterType?.type === "select" ? encounterType.options.map((o) => o.value) : [];

  it("offers a telephone contact and a written message of its own", () => {
    expect(values).toContain("telephone contact");
    expect(values).toContain("written or portal message");
  });

  it("says which rule draws the line, in the field itself", () => {
    expect(encounterType?.helpText).toContain("0460-01-.19");
  });

  it("labels both remote options as not teledentistry, where the choice is made", () => {
    const labels =
      encounterType?.type === "select"
        ? encounterType.options.filter((o) => /telephone|portal/i.test(o.value)).map((o) => o.label)
        : [];
    expect(labels).toHaveLength(2);
    for (const l of labels) expect(l).toMatch(/not teledentistry/i);
  });

  it("files a phone note without asserting teledentistry anywhere in it", () => {
    const composed = composeNote(
      note({
        "universal-core.encounter-type": { kind: "select", value: "telephone contact" },
        "universal-core.contact-method": { kind: "select", value: "telephone" },
        "universal-core.urgency": { kind: "select", value: "urgent; same-day care needed" },
        "universal-core.visit-purpose": { kind: "text", value: "The patient called about pain." }
      }),
      CORE
    );
    expect(composed).toContain("telephone contact");
    expect(composed.toLowerCase()).not.toContain("teledentistry");
  });

  it("keeps money out of the encounter list entirely", () => {
    // A cost-only conversation is a consultation. The clinical record never
    // mentions money, so there is no financial encounter type to pick.
    for (const v of values) {
      expect(v).not.toMatch(/financial|fee|payment|insurance|estimate/i);
    }
  });
});
