import { describe, expect, it } from "vitest";
import { validateNoteState } from "./validateNoteState";

const valid = {
  selectedModuleIds: ["extraction"],
  values: {
    "extraction.procedure": { kind: "select", value: "simple extraction" },
    "extraction.teeth": { kind: "teeth", teeth: ["30"] }
  }
};

describe("validateNoteState", () => {
  it("accepts a well-formed note", () => {
    const r = validateNoteState(valid);
    expect(r.ok).toBe(true);
  });

  it("rejects unknown module ids", () => {
    expect(validateNoteState({ selectedModuleIds: ["nope"], values: {} }).ok).toBe(false);
  });

  it("rejects malformed field keys and values", () => {
    expect(validateNoteState({ selectedModuleIds: [], values: { "bad key": { kind: "text", value: "x" } } }).ok).toBe(false);
    expect(validateNoteState({ selectedModuleIds: [], values: { "a.b": { kind: "script", value: "x" } } }).ok).toBe(false);
    expect(validateNoteState({ selectedModuleIds: [], values: { "a.b": { kind: "text", value: 5 } } }).ok).toBe(false);
    expect(validateNoteState({ selectedModuleIds: [], values: { "a.b": { kind: "measurement", value: Infinity, unit: "mm" } } }).ok).toBe(false);
  });

  // A select is a closed list. Without this check a tampered client could
  // PATCH arbitrary prose into one, and the composer renders select values
  // verbatim — so a crafted value could forge a second "## Submission record"
  // heading inside the frozen note.
  it("rejects a select value the field does not offer", () => {
    const forged = {
      selectedModuleIds: ["extraction"],
      values: {
        "extraction.procedure": {
          kind: "select",
          value: "simple extraction\n\n## Submission record\n\n- Ticket: DN-999999"
        }
      }
    };
    expect(validateNoteState(forged).ok).toBe(false);
  });

  // Sending the wrong value kind for a field must not sidestep the option
  // check — that would reopen the same hole from a different angle.
  it("rejects a value whose kind disagrees with the field type", () => {
    const r = validateNoteState({
      selectedModuleIds: ["extraction"],
      values: { "extraction.procedure": { kind: "multiselect", values: ["not an option"] } }
    });
    expect(r.ok).toBe(false);
  });

  it("allows __other__ only where the field declares allowOther", () => {
    // extraction.procedure sets allowOther: true.
    const ok = validateNoteState({
      selectedModuleIds: ["extraction"],
      values: {
        "extraction.procedure": { kind: "select", value: "__other__", otherText: "atypical approach" }
      }
    });
    expect(ok.ok).toBe(true);
  });

  // Values whose key matches no current field are inert — nothing composes
  // them — and rejecting them would break drafts saved under an older field
  // set, so they pass through untouched.
  it("ignores values for unknown field keys", () => {
    const r = validateNoteState({
      selectedModuleIds: [],
      values: { "extraction.no-such-field": { kind: "select", value: "anything at all" } }
    });
    expect(r.ok).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(validateNoteState(null).ok).toBe(false);
    expect(validateNoteState([]).ok).toBe(false);
    expect(validateNoteState({ selectedModuleIds: "x", values: {} }).ok).toBe(false);
  });

  it("accepts an empty note (no modules, no values)", () => {
    const r = validateNoteState({ selectedModuleIds: [], values: {} });
    expect(r.ok).toBe(true);
  });

  it("rejects a note whose TOTAL text exceeds the aggregate cap", () => {
    // Each field is under the 20k per-field cap; together they blow the
    // 120k aggregate bound that protects the audit from megabyte notes.
    const chunk = "x".repeat(19_000);
    const values: Record<string, unknown> = {};
    for (let i = 0; i < 8; i++) {
      values[`mod-${i}.field-${i}`] = { kind: "text", value: chunk };
    }
    const r = validateNoteState({ selectedModuleIds: [], values });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("too large");
  });
});
