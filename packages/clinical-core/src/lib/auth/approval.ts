import type { ModuleDef, NoteState } from "@/lib/schema/types";
import type { ClinicalRole } from "./clinicalRoles";
import { dentistOwnedKeys } from "@/lib/schema/scopeGuard";

// Approve & Lock: WHO may file a note into the permanent record.
//
// scopeGuard answers "who may WRITE a diagnosis"; this answers the next
// question the master context's HITL rule poses: who may make the note FINAL.
// The two are different acts — a hygienist lawfully records findings all day,
// but a sedation record or a note carrying a dentist's assessment becomes the
// legal record of dentist-level judgment the moment it files, and the person
// whose name freezes onto that filing is the person vouching for it.
//
// THE MECHANISM IS THE EXISTING ONE, deliberately. There is no parallel
// "approval workflow" with its own states to desynchronize: a note that needs
// a dentist's approval is filed BY the dentist. The author transfers the
// draft (the transfer rail already exists, with its own audit trail), the
// dentist reviews the actual content — not a summary of it — and files under
// their own name. Provenance comes out exactly right: the frozen submission
// names the licensed approver, the draft history names the author, and no
// checkbox pretends to be a review.

/**
 * Modules whose records are dentist-level acts end to end. Filing one is
 * vouching for an anesthetic or surgical-guidance record, whoever typed it.
 */
export const DENTIST_FILED_MODULE_IDS: ReadonlySet<string> = new Set([
  "sedation-anesthesia",
  "robotic-surgery"
]);

export interface FilingVerdict {
  allowed: boolean;
  /** Cold logic: what blocked the filing and exactly how to move. */
  message?: string;
}

function hasValue(note: NoteState, key: string): boolean {
  const v = note.values[key] as { value?: unknown; values?: unknown[] } | undefined;
  if (!v) return false;
  if (Array.isArray(v.values)) return v.values.length > 0;
  return typeof v.value === "string" ? v.value.trim().length > 0 : v.value !== undefined;
}

/**
 * May a person with this clinical role file this note?
 *
 * `unset` may file anything — the same load-bearing default as
 * canRecordClinicalJudgement, for the same reason: an unconfigured practice
 * must not find itself locked out of filing on day one. The restriction
 * arrives when the practice records who is who, which is also the moment it
 * becomes enforceable at all.
 */
export function checkFilingAuthority(
  role: ClinicalRole,
  modules: ModuleDef[],
  note: NoteState
): FilingVerdict {
  // "smilenotes" joins the unrestricted set for the same reason it exists: a
  // developer account that cannot file a sedation note cannot check that filing
  // a sedation note works.
  if (role === "unset" || role === "dentist" || role === "smilenotes") return { allowed: true };

  const selectedHighRisk = modules.filter(
    (m) => note.selectedModuleIds.includes(m.id) && DENTIST_FILED_MODULE_IDS.has(m.id)
  );
  if (selectedHighRisk.length > 0) {
    return {
      allowed: false,
      message: `Dentist must file — ${selectedHighRisk[0].title} is a dentist-level act. Transfer ownership.`
    };
  }

  const owned = dentistOwnedKeys(modules);
  for (const key of owned) {
    if (hasValue(note, key)) {
      return {
        allowed: false,
        message: "Dentist must file — Assessment or Plan present. Transfer ownership."
      };
    }
  }

  return { allowed: true };
}
