// Single source of truth: these definitions drive the form UI, the composer,
// and the audit engine. Keep every ModuleDef JSON-serializable (no functions).

export type Dentition =
  | "permanent" // 1-32
  | "primary" // A-T
  | "supernumerary-permanent" // 51-82 (nearest permanent tooth + 50)
  | "supernumerary-primary"; // AS-TS (nearest primary letter + "S")

export type ToothId = string; // validated by vocab/teeth.ts, e.g. "3", "T", "58", "AS"

export type Surface = "M" | "O" | "I" | "D" | "B" | "F" | "L";

export type Unit =
  | "mm"
  | "mL"
  | "mg"
  | "mcg"
  | "%"
  | "mm Hg"
  | "L/min"
  | "bpm"
  | "breaths/min"
  | "°C"
  | "kg"
  | "min";

export type Condition =
  | { fieldId: string; equals: string }
  | { fieldId: string; notEquals: string }
  | { fieldId: string; in: string[] }
  | { fieldId: string; notEmpty: true }
  | { all: Condition[] }
  | { any: Condition[] };

export interface FieldOption {
  value: string; // what appears in the note
  label?: string; // what appears in the dropdown (defaults to value)
}

interface BaseField {
  id: string; // unique within module; ref key = `${moduleId}.${fieldId}`
  label: string;
  required?: boolean;
  requiredIf?: Condition; // evaluated only when visible
  visibleIf?: Condition; // hidden fields are never required, rendered, or composed
  helpText?: string;
  // Who the words in this field are written FOR. Undefined (every existing
  // field) means the clinical record — precise, technical, read by clinicians
  // and lawyers. "patient" means the person in the chair reads it.
  //
  // This is load-bearing rather than descriptive. The record voice and the
  // patient voice want OPPOSITE edits from the same machinery: the standardizer
  // rewrites "x-ray" to "radiograph" and the abbreviation rule enforces it at
  // STYLE severity, which on a patient-facing field would turn plain English
  // into jargon automatically. So the marker both switches the plain-language
  // rule ON and switches the jargon machinery OFF for that field.
  audience?: "patient";
}

export interface SelectField extends BaseField {
  type: "select";
  options: FieldOption[];
  allowOther?: boolean; // adds an "Other — specify" free-text escape hatch
}

export interface MultiselectField extends BaseField {
  type: "multiselect";
  options: FieldOption[];
  joiner?: string; // default "; "
}

export interface TextField extends BaseField {
  type: "text";
  standardPhrases?: string[]; // click-to-insert phrasebook chips
  placeholderHint?: string; // e.g. "<region/tooth/surface>"
}

export interface TextareaField extends BaseField {
  type: "textarea";
  standardPhrases?: string[];
  placeholderHint?: string;
  rows?: number;
}

export interface ToothPickerField extends BaseField {
  type: "toothPicker";
  dentitions: Dentition[];
  multiple: boolean;
}

export interface SurfacePickerField extends BaseField {
  type: "surfacePicker";
  linkedToothFieldId: string; // surfaces are picked per tooth chosen in that field
}

// Sanity bounds only. This app never computes, checks, or suggests a drug dose.
export interface MeasurementField extends BaseField {
  type: "measurement";
  units: Unit[]; // first unit is the default
  min?: number;
  max?: number;
  decimals?: number;
}

export type Field =
  | SelectField
  | MultiselectField
  | TextField
  | TextareaField
  | ToothPickerField
  | SurfacePickerField
  | MeasurementField;

export interface SectionDef {
  id: string;
  title: string; // becomes a heading in the composed note
  fields: Field[];
}

export interface ModuleDef {
  id: string;
  title: string;
  order: number; // canonical position; the note always composes in ascending order
  alwaysOn?: boolean; // true only for universal-core
  description?: string;
  sections: SectionDef[];
}

export type FieldValue =
  | { kind: "select"; value: string; otherText?: string }
  | { kind: "multiselect"; values: string[] }
  | { kind: "text"; value: string }
  | { kind: "teeth"; teeth: ToothId[] }
  | { kind: "surfaces"; byTooth: Record<ToothId, Surface[]> }
  | { kind: "measurement"; value: number | null; unit: Unit };

export interface NoteState {
  selectedModuleIds: string[]; // universal-core is always present
  values: Record<string, FieldValue>; // key = `${moduleId}.${fieldId}`
}

export function fieldKey(moduleId: string, fieldId: string): string {
  return `${moduleId}.${fieldId}`;
}
