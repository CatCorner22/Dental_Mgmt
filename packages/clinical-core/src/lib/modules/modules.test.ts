import { describe, expect, it } from "vitest";
import { ALL_MODULES, MODULES_BY_ID, activeModules, moduleMatches } from "./index";
import { runTextAudit } from "@/lib/audit/engine";
import type { Condition, Field } from "@/lib/schema/types";

function allFields(moduleId: string): Field[] {
  const mod = MODULES_BY_ID.get(moduleId);
  if (!mod) throw new Error(`missing module ${moduleId}`);
  return mod.sections.flatMap((s) => s.fields);
}

function conditionFieldIds(cond: Condition): string[] {
  if ("all" in cond) return cond.all.flatMap(conditionFieldIds);
  if ("any" in cond) return cond.any.flatMap(conditionFieldIds);
  return [cond.fieldId];
}

describe("module integrity", () => {
  it("has unique module ids and ascending unique orders", () => {
    const ids = ALL_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = ALL_MODULES.map((m) => m.order);
    expect(new Set(orders).size).toBe(orders.length);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it("has exactly one always-on module: universal-core, first in order", () => {
    const alwaysOn = ALL_MODULES.filter((m) => m.alwaysOn);
    expect(alwaysOn.map((m) => m.id)).toEqual(["universal-core"]);
    expect(ALL_MODULES[0].id).toBe("universal-core");
  });

  it("covers the full router including surgery, IV sedation, and the new add-ons", () => {
    for (const id of [
      "examination",
      "emergency",
      "imaging",
      "preventive",
      "direct-restorative",
      "fixed-prosthodontic",
      "removable-prosthodontic",
      "endodontic",
      "periodontal",
      "implant",
      "operative",
      "extraction",
      "biopsy",
      "bone-graft-sinus",
      "trauma",
      "nitrous",
      "sedation-anesthesia",
      "pediatric",
      "orthodontic",
      "oral-medicine",
      "anxiety-comfort",
      "sleep-apnea",
      "tmj-tmd",
      "cosmetic",
      "medication",
      "teledentistry",
      "communication-followup",
      "pathology-result",
      "refusal-incomplete",
      "late-entry",
      "universal-procedure"
    ]) {
      expect(MODULES_BY_ID.has(id), `missing module: ${id}`).toBe(true);
    }
  });

  it("has unique field ids within each module and non-empty labels/options", () => {
    for (const mod of ALL_MODULES) {
      const fields = allFields(mod.id);
      const ids = fields.map((f) => f.id);
      expect(new Set(ids).size, `duplicate field id in ${mod.id}`).toBe(ids.length);
      for (const f of fields) {
        expect(f.label.trim().length, `${mod.id}.${f.id} label`).toBeGreaterThan(0);
        if (f.type === "select" || f.type === "multiselect") {
          expect(f.options.length, `${mod.id}.${f.id} options`).toBeGreaterThan(0);
          for (const o of f.options) expect(o.value.trim().length).toBeGreaterThan(0);
        }
        if (f.type === "measurement") {
          expect(f.units.length, `${mod.id}.${f.id} units`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("resolves every visibleIf/requiredIf reference and surface-picker link", () => {
    for (const mod of ALL_MODULES) {
      const fields = allFields(mod.id);
      const ids = new Set(fields.map((f) => f.id));
      for (const f of fields) {
        for (const cond of [f.visibleIf, f.requiredIf]) {
          if (!cond) continue;
          for (const ref of conditionFieldIds(cond)) {
            expect(ids.has(ref), `${mod.id}.${f.id} references missing field ${ref}`).toBe(true);
          }
        }
        if (f.type === "surfacePicker") {
          const linked = fields.find((x) => x.id === f.linkedToothFieldId);
          expect(linked, `${mod.id}.${f.id} linked tooth field`).toBeDefined();
          expect(linked?.type).toBe("toothPicker");
        }
      }
    }
  });

  it("never defaults a clinical assertion — no field carries a preset value", () => {
    // The FieldValue store starts empty; field defs must not smuggle defaults.
    for (const mod of ALL_MODULES) {
      for (const f of allFields(mod.id)) {
        expect("defaultValue" in f, `${mod.id}.${f.id} has a default`).toBe(false);
      }
    }
  });

  it("dogfoods its own language: labels, options, and phrases pass the terminology audit", () => {
    const badCategories = new Set(["abbreviation", "vague-phrase", "stale-text", "phi"]);
    // The abbreviation rule is the CLINICAL register — it puts "radiograph"
    // in and takes "x-ray" out. On a field written for the patient that is
    // exactly backwards, and runAudit already suppresses those findings there.
    // The dogfood has to hold the app's own patient-voice text to the same
    // standard the app holds a clinician's, or the two disagree.
    const patientCategories = new Set(["vague-phrase", "stale-text", "phi"]);
    for (const mod of ALL_MODULES) {
      for (const f of allFields(mod.id)) {
        const texts: string[] = [f.label];
        if (f.type === "select" || f.type === "multiselect") {
          // BOTH sides of every option. This audited `label ?? value`, so an
          // option carrying a friendly label was never checked on the string it
          // actually writes into the note — and the value is the one a clinician
          // is later asked to justify. "routine" as an urgency value would have
          // shipped a vague.routine finding into every note that picked it.
          for (const o of f.options) texts.push(o.value, o.label ?? o.value);
        }
        if ((f.type === "text" || f.type === "textarea") && f.standardPhrases) {
          texts.push(...f.standardPhrases);
        }
        const bad = f.audience === "patient" ? patientCategories : badCategories;
        for (const text of texts) {
          const findings = runTextAudit(text).filter(
            (x) => bad.has(x.category) || x.severity === "S0"
          );
          expect(
            findings,
            `${mod.id}.${f.id}: "${text}" -> ${findings.map((x) => x.ruleId).join(",")}`
          ).toEqual([]);
        }
      }
    }
  });
});

describe("activeModules", () => {
  it("always includes universal-core and sorts by canonical order", () => {
    const active = activeModules(["extraction", "sedation-anesthesia"]);
    expect(active[0].id).toBe("universal-core");
    expect(active.map((m) => m.id)).toEqual([
      "universal-core",
      "extraction",
      "sedation-anesthesia"
    ]);
  });
});

describe("finding a module in the picker", () => {
  const find = (q: string) => ALL_MODULES.filter((m) => moduleMatches(m, q)).map((m) => m.id);

  it("finds a module by the word clinicians say, not the word in the title", () => {
    // The regression this exists for. "TMD" appears nowhere in "TMJ and
    // Orofacial Pain Add-On", so title-only matching returned an empty list to
    // anyone who typed the abbreviation the profession uses out loud.
    expect(find("TMD")).toContain("tmj-tmd");
    expect(find("apnea")).toContain("sleep-apnea");
    expect(find("snoring")).toContain("sleep-apnea");
    expect(find("whitening")).toContain("cosmetic");
    expect(find("bleaching")).toContain("cosmetic");
  });

  it("is case-insensitive and ignores surrounding spaces", () => {
    expect(find("  tmd  ")).toContain("tmj-tmd");
    expect(find("ENDODONTIC")).toContain("endodontic");
  });

  it("returns everything for an empty query", () => {
    expect(find("").length).toBe(ALL_MODULES.length);
    expect(find("   ").length).toBe(ALL_MODULES.length);
  });

  it("still excludes modules that genuinely do not match", () => {
    expect(find("tmd")).not.toContain("preventive");
    expect(find("qqzzx")).toEqual([]);
  });
});
