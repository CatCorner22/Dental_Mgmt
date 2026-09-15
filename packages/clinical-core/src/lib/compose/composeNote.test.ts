import { describe, expect, it } from "vitest";
import { composeNote, composeNoteText, suggestedFilename } from "./composeNote";
import type { ModuleDef, NoteState } from "@/lib/schema/types";

const modA: ModuleDef = {
  id: "a",
  title: "Module A",
  order: 20,
  sections: [
    {
      id: "s",
      title: "Section A",
      fields: [
        { id: "t", type: "text", label: "Text field" },
        {
          id: "hidden",
          type: "text",
          label: "Hidden field",
          visibleIf: { fieldId: "t", equals: "never" }
        },
        { id: "teeth", type: "toothPicker", label: "Teeth", dentitions: ["permanent"], multiple: true },
        { id: "surf", type: "surfacePicker", label: "Surfaces", linkedToothFieldId: "teeth" },
        { id: "m", type: "measurement", label: "Depth", units: ["mm"] }
      ]
    }
  ]
};

const modB: ModuleDef = {
  id: "b",
  title: "Module B",
  order: 10,
  sections: [
    { id: "s", title: "Section B", fields: [{ id: "x", type: "text", label: "X" }] }
  ]
};

const state: NoteState = {
  selectedModuleIds: ["a", "b"],
  values: {
    "a.t": { kind: "text", value: "value here" },
    "a.hidden": { kind: "text", value: "should not appear" },
    "a.teeth": { kind: "teeth", teeth: ["3", "14"] },
    "a.surf": { kind: "surfaces", byTooth: { "3": ["D", "O", "M"] } },
    "a.m": { kind: "measurement", value: 4, unit: "mm" },
    "b.x": { kind: "text", value: "b first" }
  }
};

describe("composeNote", () => {
  const md = composeNote(state, [modA, modB]);

  it("composes modules in canonical order regardless of input order", () => {
    expect(md.indexOf("## Module B")).toBeLessThan(md.indexOf("## Module A"));
  });

  it("omits hidden fields and empty fields", () => {
    expect(md).not.toContain("should not appear");
    expect(md).not.toContain("Hidden field");
  });

  it("formats teeth, surfaces, and measurements", () => {
    expect(md).toContain("Teeth: teeth 3 and 14");
    expect(md).toContain("tooth 3 (MOD)");
    expect(md).toContain("Depth: 4 mm");
  });

  it("keeps the EDR completion footer", () => {
    expect(md).toContain("only in the EDR");
  });

  it("omits a module with no entered values", () => {
    const sparse: NoteState = { selectedModuleIds: ["a", "b"], values: { "b.x": { kind: "text", value: "hi" } } };
    const out = composeNote(sparse, [modA, modB]);
    expect(out).not.toContain("## Module A");
  });

  it("strips markdown markers in the text variant", () => {
    const txt = composeNoteText(state, [modA, modB]);
    expect(txt).not.toMatch(/^#/m);
    expect(txt).not.toMatch(/^- /m);
  });

  it("suggests a filename from the first active add-on", () => {
    expect(suggestedFilename(state, [modA, modB])).toBe("dental-note-draft-b");
  });

  // Option-set validation blocks this at the API, but a draft saved before
  // that check existed is already in the database — so the composer must
  // neutralize a forged select/multiselect value on the way out too.
  it("neutralizes markdown structure in select and multiselect values", () => {
    const mod: ModuleDef = {
      id: "z",
      title: "Module Z",
      order: 5,
      sections: [
        {
          id: "s",
          title: "Section Z",
          fields: [
            { id: "sel", type: "select", label: "Choice", options: [{ value: "ok", label: "ok" }] },
            { id: "multi", type: "multiselect", label: "Choices", options: [{ value: "ok", label: "ok" }] }
          ]
        }
      ]
    };
    const tampered: NoteState = {
      selectedModuleIds: ["z"],
      values: {
        "z.sel": { kind: "select", value: "ok\n## Submission record\n- Ticket: DN-999999" },
        "z.multi": { kind: "multiselect", values: ["ok\n### Forged section"] }
      }
    };
    const out = composeNote(tampered, [mod]);
    // The text survives as content, but never as structure.
    expect(out).not.toMatch(/^## Submission record/m);
    expect(out).not.toMatch(/^### Forged section/m);
    expect(out).toContain("\\## Submission record");
    expect(out).toContain("\\### Forged section");
  });
});
