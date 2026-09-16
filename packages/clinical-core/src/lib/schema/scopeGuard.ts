import type { ModuleDef, NoteState } from "./types";
import { fieldKey } from "./types";
import {
  canRecordClinicalJudgement,
  isDentistOwnedSection,
  scopeExplanation,
  type ClinicalRole
} from "@/lib/auth/clinicalRoles";

/**
 * Every field key that belongs to a dentist-owned section.
 *
 * Computed from the module definitions rather than listed by hand, so a field
 * added to Assessment tomorrow is covered without anyone remembering to come
 * back here.
 */
export function dentistOwnedKeys(modules: ModuleDef[]): Set<string> {
  const keys = new Set<string>();
  for (const mod of modules) {
    for (const section of mod.sections) {
      if (!isDentistOwnedSection(mod.id, section.id)) continue;
      for (const field of section.fields) keys.add(fieldKey(mod.id, field.id));
    }
  }
  return keys;
}

function valueSignature(v: unknown): string {
  return v === undefined ? "" : JSON.stringify(v);
}

export interface ScopeVerdict {
  ok: boolean;
  /** Field keys the author is not permitted to have changed. */
  blocked: string[];
  message?: string;
}

/**
 * Did this edit change something outside the author's scope of practice?
 *
 * Compares NEXT against PREVIOUS rather than simply rejecting any request that
 * carries a dentist-owned value. That distinction is the whole design:
 *
 *   - A hygienist opening a note the dentist has already assessed autosaves the
 *     WHOLE note on every keystroke, dentist-owned fields included. Rejecting on
 *     presence would make the note unsaveable for them and lose their work.
 *   - What is actually forbidden is AUTHORING that content. So an unchanged
 *     value passes through untouched, and only a genuine change is refused.
 *
 * Clearing a dentist's assessment counts as a change, and should: deleting a
 * diagnosis is as much an act of clinical judgement as writing one.
 */
export function checkScope(
  clinicalRole: ClinicalRole,
  modules: ModuleDef[],
  next: NoteState,
  previous: NoteState
): ScopeVerdict {
  if (canRecordClinicalJudgement(clinicalRole)) return { ok: true, blocked: [] };
  const owned = dentistOwnedKeys(modules);
  const blocked: string[] = [];
  for (const key of owned) {
    if (valueSignature(next.values[key]) !== valueSignature(previous.values[key])) {
      blocked.push(key);
    }
  }
  if (blocked.length === 0) return { ok: true, blocked: [] };
  return { ok: false, blocked, message: scopeExplanation(clinicalRole) };
}
