import { describe, expect, it } from "vitest";
import { EFFECTIVE_DATE, runSupervisionRule } from "./supervision";
import { activeModules } from "@/lib/modules";
import { fieldKey, type NoteState } from "@/lib/schema/types";
import { composeNote } from "@/lib/compose/composeNote";
import { runAudit } from "../engine";

const NEW_PATIENT = "New patient — first visit to this practice";
const ESTABLISHED = "Established patient";
const GENERAL = "General — the dentist authorized in advance";
const DIRECT = "Direct — the dentist was on the premises";

const note = (patientStatus?: string, supervision?: string): NoteState => ({
  selectedModuleIds: ["preventive"],
  values: {
    ...(patientStatus
      ? { [fieldKey("universal-core", "patient-status")]: { kind: "select", value: patientStatus } }
      : {}),
    ...(supervision
      ? { [fieldKey("universal-core", "supervision")]: { kind: "select", value: supervision } }
      : {})
  }
});

const mods = (ids: string[]) => activeModules(ids);

describe("Public Chapter 1107 — the rule that starts on a Thursday in 2027", () => {
  it("blocks filing on and after the effective date", () => {
    const findings = runSupervisionRule(note(NEW_PATIENT, GENERAL), mods(["preventive"]), EFFECTIVE_DATE);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("S1");
    expect(findings[0].message).toContain("Public Chapter 1107");
  });

  it("advises without blocking before the effective date", () => {
    const findings = runSupervisionRule(note(NEW_PATIENT, GENERAL), mods(["preventive"]), "2026-12-31");
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("S4");
    expect(findings[0].message).toMatch(/Nothing is wrong today/);
  });

  it("the boundary is exact: December 31 advises, January 1 blocks", () => {
    const dec = runSupervisionRule(note(NEW_PATIENT, GENERAL), mods(["preventive"]), "2026-12-31")[0];
    const jan = runSupervisionRule(note(NEW_PATIENT, GENERAL), mods(["preventive"]), "2027-01-01")[0];
    expect(dec.severity).toBe("S4");
    expect(jan.severity).toBe("S1");
  });

  // The rule keys on the COMBINATION, and each leg alone must stay silent —
  // an alert that fires on ordinary visits is an alert that gets overridden.
  it("is silent for an established patient", () => {
    expect(runSupervisionRule(note(ESTABLISHED, GENERAL), mods(["preventive"]), "2027-06-01")).toEqual([]);
  });

  it("is silent under direct supervision", () => {
    expect(runSupervisionRule(note(NEW_PATIENT, DIRECT), mods(["preventive"]), "2027-06-01")).toEqual([]);
  });

  it("is silent when the dentist personally provided the care", () => {
    const n = note(NEW_PATIENT, "Not applicable — the dentist personally provided this care");
    expect(runSupervisionRule(n, mods(["preventive"]), "2027-06-01")).toEqual([]);
  });

  it("is silent when no listed service module is active", () => {
    // An extraction visit is dentist work; PC 1107 lists hygiene services.
    const n: NoteState = { ...note(NEW_PATIENT, GENERAL), selectedModuleIds: ["extraction"] };
    expect(runSupervisionRule(n, mods(["extraction"]), "2027-06-01")).toEqual([]);
  });

  // The fields are contextually required — by this rule, on hygiene-service
  // notes, once the law is in force — and deliberately not schema-required,
  // because a plainly required field blocks every draft already saved.
  it("asks for unanswered fields on a hygiene note once the law is in force", () => {
    const findings = runSupervisionRule(note(undefined, undefined), mods(["preventive"]), "2027-06-01");
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("supervision.pc1107-unanswered");
    expect(findings[0].severity).toBe("S1");
  });

  it("does not ask before the law is in force", () => {
    expect(runSupervisionRule(note(undefined, undefined), mods(["preventive"]), "2026-12-31")).toEqual([]);
  });

  it("never asks on a note with no listed service, whatever the date", () => {
    const n: NoteState = { ...note(undefined, undefined), selectedModuleIds: ["extraction"] };
    expect(runSupervisionRule(n, mods(["extraction"]), "2027-06-01")).toEqual([]);
  });

  it("points the ask at whichever field is missing", () => {
    const [askBoth] = runSupervisionRule(note(undefined, undefined), mods(["preventive"]), "2027-06-01");
    expect(askBoth.fieldRef?.fieldId).toBe("patient-status");
    const [askSupervision] = runSupervisionRule(note(NEW_PATIENT, undefined), mods(["preventive"]), "2027-06-01");
    expect(askSupervision.fieldRef?.fieldId).toBe("supervision");
  });

  it("fires for each listed service family", () => {
    for (const id of ["imaging", "examination", "periodontal", "preventive"]) {
      const n: NoteState = { ...note(NEW_PATIENT, GENERAL), selectedModuleIds: [id] };
      expect(
        runSupervisionRule(n, mods([id]), "2027-06-01").length,
        `${id} is a PC 1107 listed service`
      ).toBe(1);
    }
  });

  it("points at the supervision field, so the finding can jump there", () => {
    const [finding] = runSupervisionRule(note(NEW_PATIENT, GENERAL), mods(["preventive"]), "2027-06-01");
    expect(finding.fieldRef).toEqual({ moduleId: "universal-core", fieldId: "supervision" });
  });

  it("reaches the report through runAudit with an injected date", () => {
    const n = note(NEW_PATIENT, GENERAL);
    const modules = mods(["preventive"]);
    const report = runAudit({
      note: n,
      modules,
      composedText: composeNote(n, modules, { officeName: "Test" }),
      today: "2027-02-01"
    });
    expect(report.findings.some((f) => f.ruleId === "supervision.pc1107-new-patient" && f.severity === "S1")).toBe(
      true
    );
  });
});

// ===========================================================================
// THE OWNER'S RENDERING RULE, pinned as stated:
//
//   Do not print an empty section as "Complications: None." unless the user
//   affirmatively selected it. Otherwise the note stays blocked.
//
// The composer satisfies the first half structurally — it OMITS empty fields,
// so "None" cannot appear uninvited — and the required rule satisfies the
// second: an unanswered required field is an S1 that blocks filing. These
// tests exist so neither half can regress quietly.
// ===========================================================================
describe("the rendering rule: silence never becomes 'None'", () => {
  it("an empty complication field renders NOTHING, not 'None'", () => {
    const n: NoteState = { selectedModuleIds: ["operative"], values: {} };
    const text = composeNote(n, mods(["operative"]), { officeName: "Test" });
    expect(text).not.toMatch(/complication[^\n]*none/i);
  });

  it("an affirmative selection renders, because the user said it", () => {
    const modules = mods(["operative"]);
    const complicationField = modules
      .flatMap((m) => m.sections)
      .flatMap((s) => s.fields)
      .find((f) => f.id === "complication");
    expect(complicationField, "operative module keeps a complication field").toBeDefined();
  });
});
