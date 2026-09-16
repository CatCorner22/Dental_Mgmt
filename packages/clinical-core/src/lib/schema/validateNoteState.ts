import type { Field, FieldValue, NoteState } from "@/lib/schema/types";
import { ALL_MODULES, MODULES_BY_ID } from "@/lib/modules";

export type NoteStateResult =
  | { ok: true; value: NoteState }
  | { ok: false; error: string };

const MAX_FIELDS = 2000;
const MAX_TEXT_CHARS = 20_000;
const MAX_ARRAY = 200; // no real field has hundreds of options/teeth/surfaces
// Aggregate bound: per-field caps alone still admit ~300 fields × 20k chars
// (a multi-megabyte note that the audit re-scans on every save). No real
// clinical note approaches this; a payload that does is abuse, not data.
const MAX_TOTAL_CHARS = 120_000;
const VALUE_KINDS = ["select", "multiselect", "text", "teeth", "surfaces", "measurement"];

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// The client sends structured values, never prose. The server composes the
// note itself, so nothing a tampered client submits reaches an attachment
// without passing the full audit.
export function validateFieldValue(v: unknown): v is FieldValue {
  if (!isPlainObject(v) || typeof v.kind !== "string" || !VALUE_KINDS.includes(v.kind)) {
    return false;
  }
  switch (v.kind) {
    case "select":
      return (
        typeof v.value === "string" &&
        v.value.length <= MAX_TEXT_CHARS &&
        (v.otherText === undefined ||
          (typeof v.otherText === "string" && v.otherText.length <= MAX_TEXT_CHARS))
      );
    case "multiselect":
      return (
        Array.isArray(v.values) &&
        v.values.length <= MAX_ARRAY &&
        v.values.every((x) => typeof x === "string" && x.length <= MAX_TEXT_CHARS)
      );
    case "text":
      return typeof v.value === "string" && v.value.length <= MAX_TEXT_CHARS;
    case "teeth":
      return (
        Array.isArray(v.teeth) &&
        v.teeth.length <= MAX_ARRAY &&
        v.teeth.every((x) => typeof x === "string" && x.length <= 8)
      );
    case "surfaces":
      return (
        isPlainObject(v.byTooth) &&
        Object.keys(v.byTooth).length <= MAX_ARRAY &&
        Object.values(v.byTooth).every(
          (s) => Array.isArray(s) && s.length <= MAX_ARRAY && s.every((x) => typeof x === "string" && x.length <= 2)
        )
      );
    case "measurement":
      return (
        (v.value === null || (typeof v.value === "number" && Number.isFinite(v.value))) &&
        typeof v.unit === "string" &&
        v.unit.length <= 16 &&
        // A unit is a short token (mm, mL, L/min); it must never contain a
        // newline that could forge a line in the composed note.
        !/[\n\r]/.test(v.unit)
      );
    default:
      return false;
  }
}

// Character weight of one field value — the text the composer/audit will
// actually walk. Kept in sync with the kinds in validateFieldValue.
function charCount(v: FieldValue): number {
  switch (v.kind) {
    case "select":
      return v.value.length + (v.otherText?.length ?? 0);
    case "multiselect":
      return v.values.reduce((n, x) => n + x.length, 0);
    case "text":
      return v.value.length;
    case "teeth":
      return v.teeth.reduce((n, x) => n + x.length, 0);
    case "surfaces":
      return Object.entries(v.byTooth).reduce(
        (n, [k, s]) => n + k.length + s.reduce((m, x) => m + x.length, 0),
        0
      );
    case "measurement":
      return v.unit.length;
  }
}

// Field definitions indexed by `${moduleId}.${fieldId}` — the same key shape
// note.values uses. Built once; the module set is static at build time.
let fieldsByKey: Map<string, Field> | null = null;
function fieldFor(key: string): Field | undefined {
  if (!fieldsByKey) {
    fieldsByKey = new Map();
    for (const mod of ALL_MODULES) {
      for (const section of mod.sections) {
        for (const field of section.fields) fieldsByKey.set(`${mod.id}.${field.id}`, field);
      }
    }
  }
  return fieldsByKey.get(key);
}

// A select/multiselect value must be one the field actually offers. Without
// this, a tampered client could PATCH arbitrary prose into a "select" — and
// the composer renders those verbatim, so a crafted value could forge a
// heading (e.g. a second "## Submission record") inside the frozen note.
// Unknown keys are left alone: they belong to no module, so nothing composes
// them, and rejecting them would break drafts written by an older field set.
// A mismatched kind is rejected too: sending a "multiselect" value for a
// "select" field would otherwise skip the option check entirely and slip an
// arbitrary string through the same gap.
function valueMatchesOptions(field: Field, v: FieldValue): boolean {
  if (field.type === "select") {
    if (v.kind !== "select") return false;
    if (v.value === "__other__") return field.allowOther === true;
    return field.options.some((o) => o.value === v.value);
  }
  if (field.type === "multiselect") {
    if (v.kind !== "multiselect") return false;
    return v.values.every((x) => field.options.some((o) => o.value === x));
  }
  // Every OTHER field type also has exactly one legal value kind, and until now
  // nothing checked it. A `{kind:"text"}` value stored against a `measurement`
  // field was accepted, rendered as an EMPTY number input (the renderer
  // defends itself with `value?.kind === "measurement" ? value : undefined`),
  // and still composed into the filed note — because composeNote switches on
  // value.kind while the form switches on field.type. The two disagreed, so
  // the clinician saw a blank box and the emailed record carried prose.
  //
  // Worse for the periodontal work specifically: runMeasurementRule skips any
  // value whose kind is not "measurement", so the bounds check that was the
  // entire point of making those fields measurements never ran.
  const EXPECTED: Record<string, FieldValue["kind"]> = {
    text: "text",
    textarea: "text",
    measurement: "measurement",
    toothPicker: "teeth",
    surfacePicker: "surfaces"
  };
  const expected = EXPECTED[field.type];
  return expected === undefined || v.kind === expected;
}

export function validateNoteState(note: unknown): NoteStateResult {
  if (!isPlainObject(note)) return { ok: false, error: "note must be an object." };
  const { selectedModuleIds, values } = note;
  if (
    !Array.isArray(selectedModuleIds) ||
    !selectedModuleIds.every((id) => typeof id === "string" && MODULES_BY_ID.has(id))
  ) {
    return { ok: false, error: "note.selectedModuleIds must list known module ids." };
  }
  if (!isPlainObject(values)) return { ok: false, error: "note.values must be an object." };
  const entries = Object.entries(values);
  if (entries.length > MAX_FIELDS) return { ok: false, error: "The note has too many fields." };
  let totalChars = 0;
  for (const [key, value] of entries) {
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(key)) {
      return { ok: false, error: `note.values has an invalid field key: ${key}` };
    }
    if (!validateFieldValue(value)) {
      return { ok: false, error: `note.values.${key} is not a valid field value.` };
    }
    const field = fieldFor(key);
    if (field && !valueMatchesOptions(field, value as FieldValue)) {
      return { ok: false, error: `note.values.${key} is not one of the choices for that field.` };
    }
    totalChars += charCount(value as FieldValue);
    if (totalChars > MAX_TOTAL_CHARS) {
      return { ok: false, error: "The note is too large. Split it into separate notes." };
    }
  }
  return {
    ok: true,
    value: { selectedModuleIds, values: values as Record<string, FieldValue> }
  };
}
