import type { Condition, Field, FieldValue, NoteState } from "./types";
import { fieldKey } from "./types";

function valueAsStrings(v: FieldValue | undefined): string[] {
  if (!v) return [];
  switch (v.kind) {
    case "select":
      return v.value ? [v.value] : [];
    case "multiselect":
      return v.values;
    case "text":
      return v.value.trim() ? [v.value] : [];
    case "teeth":
      return v.teeth;
    case "surfaces":
      return Object.keys(v.byTooth);
    case "measurement":
      return v.value === null ? [] : [String(v.value)];
  }
}

export function evaluateCondition(
  cond: Condition,
  moduleId: string,
  state: NoteState
): boolean {
  if ("all" in cond) return cond.all.every((c) => evaluateCondition(c, moduleId, state));
  if ("any" in cond) return cond.any.some((c) => evaluateCondition(c, moduleId, state));
  const values = valueAsStrings(state.values[fieldKey(moduleId, cond.fieldId)]);
  if ("equals" in cond) return values.length === 1 && values[0] === cond.equals;
  if ("notEquals" in cond) return values.length !== 1 || values[0] !== cond.notEquals;
  if ("in" in cond) return values.some((v) => cond.in.includes(v));
  return values.length > 0; // notEmpty
}

export function isFieldVisible(field: Field, moduleId: string, state: NoteState): boolean {
  return field.visibleIf ? evaluateCondition(field.visibleIf, moduleId, state) : true;
}

export function isFieldRequired(field: Field, moduleId: string, state: NoteState): boolean {
  if (!isFieldVisible(field, moduleId, state)) return false;
  if (field.required) return true;
  return field.requiredIf ? evaluateCondition(field.requiredIf, moduleId, state) : false;
}

export function isValueEmpty(v: FieldValue | undefined): boolean {
  if (!v) return true;
  switch (v.kind) {
    case "select":
      return v.value === "" || (v.value === "__other__" && !(v.otherText ?? "").trim());
    case "multiselect":
      return v.values.length === 0;
    case "text":
      return v.value.trim() === "";
    case "teeth":
      return v.teeth.length === 0;
    case "surfaces":
      return Object.values(v.byTooth).every((s) => s.length === 0);
    case "measurement":
      return v.value === null;
  }
}
