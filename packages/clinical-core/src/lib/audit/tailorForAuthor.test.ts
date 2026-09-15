import { describe, expect, it } from "vitest";
import { tailorAuditFindings } from "./tailorForAuthor";
import { activeModules } from "@/lib/modules";
import type { AuditFinding } from "./types";
import type { NoteState } from "@/lib/schema/types";

const modules = activeModules([]);
const emptyNote: NoteState = { selectedModuleIds: [], values: {} };

describe("tailorAuditFindings", () => {
  it("leaves dentist and unset authors unchanged", () => {
    const findings: AuditFinding[] = [
      {
        ruleId: "required.missing",
        category: "required",
        severity: "S1",
        message: "Diagnosis empty",
        fieldRef: { moduleId: "universal-core", fieldId: "diagnosis" }
      }
    ];
    expect(tailorAuditFindings(findings, "dentist", emptyNote, modules)).toEqual(findings);
    expect(tailorAuditFindings(findings, "unset", emptyNote, modules)).toEqual(findings);
  });

  it("replaces dentist-owned required.missing with a handoff cue for hygienists", () => {
    const findings: AuditFinding[] = [
      {
        ruleId: "required.missing",
        category: "required",
        severity: "S1",
        message: "Diagnosis empty",
        fieldRef: { moduleId: "universal-core", fieldId: "diagnosis" }
      },
      {
        ruleId: "required.missing",
        category: "required",
        severity: "S1",
        message: "Encounter type empty",
        fieldRef: { moduleId: "universal-core", fieldId: "encounter-type" }
      },
      {
        ruleId: "complete.clinical-rationale",
        category: "required",
        severity: "S2",
        message: "Needs rationale"
      }
    ];
    const out = tailorAuditFindings(findings, "hygienist", emptyNote, modules);
    expect(out.some((f) => f.ruleId === "scope.author-handoff")).toBe(true);
    expect(out.some((f) => f.fieldRef?.fieldId === "diagnosis")).toBe(false);
    expect(out.some((f) => f.ruleId === "complete.clinical-rationale")).toBe(false);
    // Non-judgement required fields still surface.
    expect(out.some((f) => f.fieldRef?.fieldId === "encounter-type")).toBe(true);
  });
});
