import { describe, expect, it } from "vitest";
import { activeModules, MODULES_BY_ID } from "./index";
import { runMeasurementRule } from "@/lib/audit/rules/measurement";
import { runRequiredRule } from "@/lib/audit/rules/required";
import { fieldKey } from "@/lib/schema/types";
import type { Field, NoteState, Unit } from "@/lib/schema/types";

// Periodontics is the discipline whose practice IS comparing numbers between
// visits, and it was the least structured module in the tool. Every summary
// measure collapsed into one optional single-line field whose standard phrase
// was "Site-specific chart linked in the EDR" — so a note could satisfy the
// whole periodontal record by pointing somewhere else.

const modules = activeModules(["periodontal"]);
const note = (values: NoteState["values"] = {}): NoteState => ({
  selectedModuleIds: ["periodontal"],
  values
});

const fields = (): Field[] =>
  MODULES_BY_ID.get("periodontal")!.sections.flatMap((s) => s.fields);
const fieldOf = (id: string): Field => {
  const f = fields().find((x) => x.id === id);
  if (!f) throw new Error(`missing periodontal.${id}`);
  return f;
};

describe("the summary measures are measurements, so the audit can see them", () => {
  const cases: Array<[string, Unit, number]> = [
    ["ppd-max", "mm", 40],
    ["cal-max", "mm", 40],
    ["recession-max", "mm", 40],
    ["bop-percent", "%", 400],
    ["plaque-percent", "%", 400]
  ];

  for (const [id, unit, absurd] of cases) {
    it(`${id} is bounds-checked`, () => {
      const f = fieldOf(id);
      expect(f.type, `${id} must be a measurement or nothing inspects it`).toBe("measurement");
      const findings = runMeasurementRule(
        note({ [fieldKey("periodontal", id)]: { kind: "measurement", value: absurd, unit } }),
        modules
      );
      expect(findings.map((x) => x.ruleId)).toContain("measurement.range");
      expect(findings[0].severity).toBe("S2"); // review, never a block
    });
  }

  it("passes ordinary periodontal numbers silently", () => {
    const findings = runMeasurementRule(
      note({
        [fieldKey("periodontal", "ppd-max")]: { kind: "measurement", value: 6, unit: "mm" },
        [fieldKey("periodontal", "cal-max")]: { kind: "measurement", value: 4, unit: "mm" },
        [fieldKey("periodontal", "bop-percent")]: { kind: "measurement", value: 18, unit: "%" },
        [fieldKey("periodontal", "plaque-percent")]: { kind: "measurement", value: 30, unit: "%" }
      }),
      modules
    );
    expect(findings).toEqual([]);
  });

  it("records a zero rather than treating it as unanswered", () => {
    // Zero bleeding is a real and good finding. A field that cannot distinguish
    // "0%" from "nobody looked" loses the comparison the next visit needs.
    const findings = runMeasurementRule(
      note({ [fieldKey("periodontal", "bop-percent")]: { kind: "measurement", value: 0, unit: "%" } }),
      modules
    );
    expect(findings).toEqual([]);
  });
});

describe("pointing at the EDR is now an answer, not the whole record", () => {
  it("asks WHEN the chart was recorded, and requires it", () => {
    const missing = runRequiredRule(note(), modules)
      .filter((f) => f.fieldRef?.moduleId === "periodontal")
      .map((f) => f.fieldRef?.fieldId);
    expect(missing).toContain("chart-status");
  });

  it("offers an option for there being no chart at all", () => {
    // Without this the required field pressures someone into implying a chart
    // exists. "Charting was not completed" has to be sayable.
    const f = fieldOf("chart-status");
    expect(f.type).toBe("select");
    if (f.type === "select") {
      const values = f.options.map((o) => o.value).join(" | ");
      expect(values).toMatch(/not completed at this visit/);
      expect(values).toMatch(/at a previous visit/);
    }
  });

  it("keeps the narrative and keeps the EDR phrase available", () => {
    // Numbers cannot carry a mucogingival finding or a failing implant, and
    // removing the phrase entirely would just make people type it by hand.
    const f = fieldOf("chart");
    expect(f.type).toBe("textarea");
    if (f.type === "textarea") {
      expect(f.standardPhrases?.join(" ")).toMatch(/recorded in the EDR/);
    }
  });
});

describe("the graded findings use the scales clinicians use", () => {
  it("mobility and furcation are picklists with an unassessed option", () => {
    for (const id of ["mobility-max", "furcation-max", "suppuration"]) {
      const f = fieldOf(id);
      expect(f.type, id).toBe("select");
      if (f.type === "select") {
        expect(f.options.map((o) => o.value).join(" | "), id).toMatch(/not assessed at this visit/);
      }
    }
  });

  it("none of the new fields carries a default clinical assertion", () => {
    for (const f of fields()) expect("defaultValue" in f, f.id).toBe(false);
  });
});
