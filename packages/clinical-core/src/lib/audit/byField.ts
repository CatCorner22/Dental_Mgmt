import type { AuditFinding } from "./types";
import { fieldKey } from "@/lib/schema/types";

export type FieldFindings = Record<string, AuditFinding[]>;

// Group findings that carry a fieldRef by their "moduleId.fieldId" key, so the
// form can mark each field invalid and show its findings inline.
export function findingsByField(findings: AuditFinding[]): FieldFindings {
  const map: FieldFindings = {};
  for (const f of findings) {
    if (!f.fieldRef) continue;
    const key = fieldKey(f.fieldRef.moduleId, f.fieldRef.fieldId);
    (map[key] ??= []).push(f);
  }
  return map;
}

// A field is "invalid" for a11y purposes when it carries a STOP or REQUIRED.
export function fieldIsInvalid(list: AuditFinding[] | undefined): boolean {
  return !!list?.some((f) => f.severity === "S0" || f.severity === "S1");
}

/**
 * WHAT THE WRITER GOT WRONG, VERSUS WHAT THEY HAVE NOT REACHED YET.
 *
 * These are not the same thing and the form was treating them as one. Opening
 * a brand-new note ran the audit against an empty state, every required field
 * raised `required.missing`, and each of those was rendered as an S1 — which
 * on the field meant `aria-invalid="true"` and an assertive `role="alert"`
 * list. A blank note therefore arrived already carrying about a dozen invalid
 * controls and nineteen live regions, so a screen reader read out a list of
 * errors before a single key had been pressed, and a sighted writer met a
 * screen of red under fields they had not yet had the chance to fill in.
 *
 * Nobody has made a mistake at that point. The section-collapse logic already
 * says this in as many words — "an empty note is not a note with problems; it
 * is an empty note" — and this is the same rule applied to the field.
 *
 * `touched` is the hinge: once somebody has typed in a box and emptied it
 * again, the missing value IS an error, and it is announced as one.
 */
export function splitFieldFindings(
  list: AuditFinding[] | undefined,
  touched: boolean
): { errors: AuditFinding[]; pending: AuditFinding[] } {
  if (!list?.length) return { errors: [], pending: [] };
  if (touched) return { errors: list, pending: [] };
  const errors: AuditFinding[] = [];
  const pending: AuditFinding[] = [];
  for (const f of list) (f.ruleId === "required.missing" ? pending : errors).push(f);
  return { errors, pending };
}
