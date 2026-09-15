// Tailor audit findings to the writer's clinical capabilities.
//
// The note's defects do not change. What changes is whether we ASK an
// auxiliary to fill dentist-owned judgement (they cannot) or surface a single
// clear handoff cue instead. Filing authority remains the hard stop.

import { canRecordClinicalJudgement, type ClinicalRole } from "@/lib/auth/clinicalRoles";
import { isDentistJudgementRule } from "@/lib/scope/authorCapabilities";
import { dentistOwnedKeys } from "@/lib/schema/scopeGuard";
import { fieldKey, type ModuleDef, type NoteState } from "@/lib/schema/types";
import { isValueEmpty } from "@/lib/schema/conditions";
import type { AuditFinding } from "./types";

function dentistOwnedContentPresent(note: NoteState, modules: ModuleDef[]): boolean {
  const owned = dentistOwnedKeys(modules);
  for (const key of owned) {
    if (!isValueEmpty(note.values[key])) return true;
  }
  return false;
}

/**
 * When the author cannot record clinical judgement and Assessment/Plan are
 * still empty, drop judgement-coaching findings and required.missing on
 * dentist-owned fields, and add one S3 handoff cue.
 */
export function tailorAuditFindings(
  findings: AuditFinding[],
  role: ClinicalRole | undefined,
  note: NoteState,
  modules: ModuleDef[]
): AuditFinding[] {
  if (!role || canRecordClinicalJudgement(role)) return findings;
  if (dentistOwnedContentPresent(note, modules)) {
    // Content already in dentist-owned fields: keep findings; filing will block.
    return findings;
  }

  const owned = dentistOwnedKeys(modules);
  const kept = findings.filter((f) => {
    if (isDentistJudgementRule(f.ruleId)) return false;
    if (
      f.ruleId === "required.missing" &&
      f.fieldRef &&
      owned.has(fieldKey(f.fieldRef.moduleId, f.fieldRef.fieldId))
    ) {
      return false;
    }
    return true;
  });
  if (kept.length === findings.length) return findings;

  const handoff: AuditFinding = {
    ruleId: "scope.author-handoff",
    category: "required",
    severity: "S3",
    message:
      "Assessment and Plan are dentist-owned. Keep documenting findings and what you performed; transfer the draft when the dentist is ready to diagnose and plan."
  };
  return [...kept, handoff];
}
