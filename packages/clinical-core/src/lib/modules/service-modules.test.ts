import { describe, expect, it } from "vitest";
import { activeModules, MODULES_BY_ID } from "./index";
import { runMeasurementRule } from "@/lib/audit/rules/measurement";
import { runRequiredRule } from "@/lib/audit/rules/required";
import { isFieldVisible } from "@/lib/schema/conditions";
import { fieldKey } from "@/lib/schema/types";
import type { Field, NoteState } from "@/lib/schema/types";

// The three service lines Cornerstone actually offers that the tool had no
// place to record: sleep apnea appliance therapy, TMD, and elective cosmetic
// work. Each module's header comment makes a claim about how it behaves. These
// are those claims, executed — a comment asserting that the range audit
// inspects a field is worth nothing if nobody ever ran it.

const note = (ids: string[], values: NoteState["values"] = {}): NoteState => ({
  selectedModuleIds: ids,
  values
});

const fieldOf = (moduleId: string, fieldId: string): Field => {
  const f = MODULES_BY_ID.get(moduleId)
    ?.sections.flatMap((s) => s.fields)
    .find((x) => x.id === fieldId);
  if (!f) throw new Error(`missing field ${moduleId}.${fieldId}`);
  return f;
};

describe("TMJ range of motion is measured, not described", () => {
  // The whole reason these are `measurement` fields rather than text. A number
  // typed into a paragraph is invisible to every check in the app; the same
  // number in a measurement field gets bounds-checked and can be compared
  // against the next visit.
  const modules = activeModules(["tmj-tmd"]);

  it("flags an opening that has to be a typo", () => {
    const state = note(["tmj-tmd"], {
      [fieldKey("tmj-tmd", "mio")]: { kind: "measurement", value: 90, unit: "mm" }
    });
    const findings = runMeasurementRule(state, modules);
    expect(findings.map((f) => f.ruleId)).toContain("measurement.range");
    // Sanity bound, never a clinical judgement — it asks a human to look.
    expect(findings[0].severity).toBe("S2");
    expect(findings[0].message).toContain("typo");
  });

  it("passes a normal opening silently", () => {
    const state = note(["tmj-tmd"], {
      [fieldKey("tmj-tmd", "mio")]: { kind: "measurement", value: 45, unit: "mm" }
    });
    expect(runMeasurementRule(state, modules)).toEqual([]);
  });

  it("bounds the excursions and protrusion too", () => {
    for (const id of ["excursion-right", "excursion-left", "protrusion"]) {
      const f = fieldOf("tmj-tmd", id);
      expect(f.type, `${id} must be a measurement to be audited`).toBe("measurement");
      if (f.type === "measurement") {
        expect(f.units).toContain("mm");
        expect(f.max).toBeDefined();
      }
    }
  });

  it("hides appliance detail until an appliance is actually fitted", () => {
    const none = note(["tmj-tmd"], {
      [fieldKey("tmj-tmd", "appliance")]: { kind: "select", value: "none at this visit" }
    });
    const splint = note(["tmj-tmd"], {
      [fieldKey("tmj-tmd", "appliance")]: {
        kind: "select",
        value: "flat-plane stabilization splint"
      }
    });
    const detail = fieldOf("tmj-tmd", "appliance-detail");
    expect(isFieldVisible(detail, "tmj-tmd", none)).toBe(false);
    expect(isFieldVisible(detail, "tmj-tmd", splint)).toBe(true);
  });
});

describe("sleep apnea records somebody else's diagnosis", () => {
  // A dentist treats sleep-disordered breathing on a physician's diagnosis. A
  // note that reads as though the dental practice diagnosed the condition
  // describes an act outside the practice of dentistry, so the fields that
  // attribute the diagnosis are the required ones.
  const modules = activeModules(["sleep-apnea"]);

  it("will not let the referral and its source go unstated", () => {
    const missing = runRequiredRule(note(["sleep-apnea"]), modules).filter(
      (f) => f.fieldRef?.moduleId === "sleep-apnea"
    );
    const ids = missing.map((f) => f.fieldRef?.fieldId);
    expect(ids).toContain("referral-source");
    expect(ids).toContain("diagnosis-source");
  });

  it("offers a way to say the diagnosis is NOT on file", () => {
    // The honest option has to exist, or the required field pressures someone
    // into asserting a physician diagnosis they have not seen.
    const f = fieldOf("sleep-apnea", "diagnosis-source");
    expect(f.type).toBe("select");
    if (f.type === "select") {
      const values = f.options.map((o) => o.value).join(" | ");
      expect(values).toMatch(/not yet on file/);
      expect(values).toMatch(/no diagnosis on file/);
    }
  });

  it("asks the morning occlusion question at every visit", () => {
    // Occlusal change is the commonest complication of this therapy. It is
    // required rather than optional precisely so it cannot be skipped quietly.
    expect(fieldOf("sleep-apnea", "morning-occlusion").required).toBe(true);
    expect(fieldOf("sleep-apnea", "efficacy-followup").required).toBe(true);
  });

  it("never asks the tool to compute or convert a severity index", () => {
    const f = fieldOf("sleep-apnea", "severity-reported");
    expect(f.helpText).toMatch(/Do not compute, estimate, or convert/);
  });
});

describe("cosmetic work is elective, so the conversation is the record", () => {
  const modules = activeModules(["cosmetic"]);

  it("requires the goal, the expectations, and the consent discussion", () => {
    const missing = runRequiredRule(note(["cosmetic"]), modules)
      .filter((f) => f.fieldRef?.moduleId === "cosmetic")
      .map((f) => f.fieldRef?.fieldId);
    expect(missing).toContain("patient-goal");
    expect(missing).toContain("expectations");
    expect(missing).toContain("consent");
  });

  it("states the consent options as a discussion, not a conclusion", () => {
    // "Consent obtained" is on this app's own vague-phrase list, and the module
    // integrity suite caught it here when these options first said it. Keeping
    // the assertion means the wording cannot quietly regress.
    const f = fieldOf("cosmetic", "consent");
    if (f.type === "select") {
      for (const o of f.options) {
        expect(o.value).not.toMatch(/consent\s+(?:was\s+)?obtained/i);
        expect(o.value).toMatch(/discussed/i);
      }
    }
  });

  it("separates consent to treat from consent to publish the photographs", () => {
    const f = fieldOf("cosmetic", "photos");
    if (f.type === "select") {
      expect(f.options.map((o) => o.value).join(" | ")).toMatch(/separate written consent/);
    }
  });

  it("only asks for the trial response once a trial happened", () => {
    const none = note(["cosmetic"], {
      [fieldKey("cosmetic", "mockup")]: { kind: "select", value: "none at this visit" }
    });
    const trialled = note(["cosmetic"], {
      [fieldKey("cosmetic", "mockup")]: { kind: "select", value: "intraoral mock-up trialled" }
    });
    const response = fieldOf("cosmetic", "patient-response");
    expect(isFieldVisible(response, "cosmetic", none)).toBe(false);
    expect(isFieldVisible(response, "cosmetic", trialled)).toBe(true);
  });
});

describe("the new modules are add-ons, not defaults", () => {
  it("none of them turn themselves on", () => {
    const active = activeModules([]).map((m) => m.id);
    for (const id of ["sleep-apnea", "tmj-tmd", "cosmetic"]) {
      expect(active).not.toContain(id);
    }
  });

  it("each composes in its declared order without disturbing the others", () => {
    const ids = activeModules(["cosmetic", "sleep-apnea", "tmj-tmd"]).map((m) => m.id);
    expect(ids).toEqual(["universal-core", "sleep-apnea", "tmj-tmd", "cosmetic"]);
  });
});
