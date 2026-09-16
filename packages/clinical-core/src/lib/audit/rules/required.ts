import type { AuditFinding } from "../types";
import type { ModuleDef, NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldRequired, isValueEmpty } from "@/lib/schema/conditions";

export function runRequiredRule(state: NoteState, modules: ModuleDef[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (!isFieldRequired(field, mod.id, state)) continue;
        if (!isValueEmpty(state.values[fieldKey(mod.id, field.id)])) continue;
        findings.push({
          ruleId: "required.missing",
          category: "required",
          severity: "S1",
          message: `"${field.label}" (${mod.title}) is required and empty. Enter the fact, or state not assessed, not applicable, unknown, or unresolved.`,
          fieldRef: { moduleId: mod.id, fieldId: field.id }
        });
      }
    }
  }
  return findings;
}
