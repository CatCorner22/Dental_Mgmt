import type { AuditFinding } from "../types";
import type { ModuleDef, NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible } from "@/lib/schema/conditions";

// Sanity bounds only — never a dose check. A measurement outside the field's
// declared min/max is almost always a typo (an extra digit, a wrong unit), so
// it is a REVIEW item, not a silent pass. A unit the field does not list is a
// STYLE fix. Neither ever blocks; both just surface for a clinician's eye.
export function runMeasurementRule(state: NoteState, modules: ModuleDef[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (field.type !== "measurement") continue;
        if (!isFieldVisible(field, mod.id, state)) continue;
        const value = state.values[fieldKey(mod.id, field.id)];
        if (!value || value.kind !== "measurement" || value.value === null) continue;
        const fieldRef = { moduleId: mod.id, fieldId: field.id };

        if (field.units.length > 0 && !field.units.includes(value.unit as never)) {
          findings.push({
            ruleId: "measurement.unit",
            category: "measurement",
            severity: "S3",
            message: `"${value.unit}" is not an expected unit for ${field.label}. Use ${field.units.join(" or ")}.`,
            matchedText: `${value.value} ${value.unit}`,
            fieldRef
          });
        }

        const belowMin = field.min !== undefined && value.value < field.min;
        const aboveMax = field.max !== undefined && value.value > field.max;
        if (belowMin || aboveMax) {
          findings.push({
            ruleId: "measurement.range",
            category: "measurement",
            severity: "S2",
            message: `${value.value} ${value.unit} is outside the usual range for ${field.label}${
              field.min !== undefined && field.max !== undefined ? ` (${field.min}–${field.max})` : ""
            }. Check for a typo before a clinician confirms it.`,
            matchedText: `${value.value} ${value.unit}`,
            fieldRef
          });
        }
      }
    }
  }
  return findings;
}
