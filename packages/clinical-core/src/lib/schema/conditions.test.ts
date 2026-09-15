import { describe, expect, it } from "vitest";
import { evaluateCondition, isFieldRequired, isFieldVisible, isValueEmpty } from "./conditions";
import type { Field, NoteState } from "./types";

const state: NoteState = {
  selectedModuleIds: ["m"],
  values: {
    "m.a": { kind: "select", value: "x" },
    "m.b": { kind: "text", value: "  " },
    "m.c": { kind: "multiselect", values: ["p", "q"] },
    "m.d": { kind: "measurement", value: 5, unit: "mm" }
  }
};

describe("evaluateCondition", () => {
  it("handles equals / notEquals / in / notEmpty", () => {
    expect(evaluateCondition({ fieldId: "a", equals: "x" }, "m", state)).toBe(true);
    expect(evaluateCondition({ fieldId: "a", equals: "y" }, "m", state)).toBe(false);
    expect(evaluateCondition({ fieldId: "a", notEquals: "y" }, "m", state)).toBe(true);
    expect(evaluateCondition({ fieldId: "c", in: ["q", "z"] }, "m", state)).toBe(true);
    expect(evaluateCondition({ fieldId: "b", notEmpty: true }, "m", state)).toBe(false);
    expect(evaluateCondition({ fieldId: "d", notEmpty: true }, "m", state)).toBe(true);
    expect(evaluateCondition({ fieldId: "missing", notEmpty: true }, "m", state)).toBe(false);
  });

  it("handles all / any composition", () => {
    expect(
      evaluateCondition(
        { all: [{ fieldId: "a", equals: "x" }, { fieldId: "d", notEmpty: true }] },
        "m",
        state
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { any: [{ fieldId: "a", equals: "y" }, { fieldId: "d", notEmpty: true }] },
        "m",
        state
      )
    ).toBe(true);
  });
});

describe("visibility and requiredness", () => {
  const hiddenRequired: Field = {
    id: "h",
    type: "text",
    label: "H",
    required: true,
    visibleIf: { fieldId: "a", equals: "never" }
  };

  it("a hidden field is never required, even with required: true", () => {
    expect(isFieldVisible(hiddenRequired, "m", state)).toBe(false);
    expect(isFieldRequired(hiddenRequired, "m", state)).toBe(false);
  });

  it("requiredIf activates only when its condition holds", () => {
    const f: Field = {
      id: "r",
      type: "text",
      label: "R",
      requiredIf: { fieldId: "a", equals: "x" }
    };
    expect(isFieldRequired(f, "m", state)).toBe(true);
  });
});

describe("isValueEmpty", () => {
  it("treats whitespace text, empty lists, and null measurements as empty", () => {
    expect(isValueEmpty({ kind: "text", value: "   " })).toBe(true);
    expect(isValueEmpty({ kind: "multiselect", values: [] })).toBe(true);
    expect(isValueEmpty({ kind: "measurement", value: null, unit: "mm" })).toBe(true);
    expect(isValueEmpty({ kind: "teeth", teeth: [] })).toBe(true);
    expect(isValueEmpty({ kind: "surfaces", byTooth: { "3": [] } })).toBe(true);
    expect(isValueEmpty(undefined)).toBe(true);
  });

  it("treats other-select without text as empty", () => {
    expect(isValueEmpty({ kind: "select", value: "__other__", otherText: " " })).toBe(true);
    expect(isValueEmpty({ kind: "select", value: "__other__", otherText: "named" })).toBe(false);
  });
});
