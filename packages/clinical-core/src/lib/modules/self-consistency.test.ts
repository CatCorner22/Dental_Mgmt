import { describe, expect, it } from "vitest";
import { ALL_MODULES } from "./index";
import { newSpellingBudget, runSpellingRule } from "@/lib/audit/rules/spelling";
import { standardize } from "@/lib/standardize/standardize";
import { runTextAudit } from "@/lib/audit/engine";
import { validateNoteState } from "@/lib/schema/validateNoteState";

// The tool must not disagree with itself. Every case here is the app either
// flagging text it wrote, or editing text and then flagging its own edit.

describe("the app's own phrases pass the app's own spell check", () => {
  it("no standard phrase trips spelling.unknown-word", () => {
    // The module integrity suite dogfoods runTextAudit, which does NOT include
    // the spelling rule — so three new modules shipped 16 words the office
    // lexicon did not know, and every sleep-apnea, TMD and cosmetic note built
    // from the supplied phrasing carried rows in its FROZEN, EMAILED audit
    // report saying the tool suspected its own wording was misspelled.
    const flagged: string[] = [];
    for (const mod of ALL_MODULES) {
      for (const section of mod.sections) {
        for (const field of section.fields) {
          if (field.type !== "text" && field.type !== "textarea") continue;
          for (const phrase of field.standardPhrases ?? []) {
            const hits = runSpellingRule(
              phrase,
              { moduleId: mod.id, fieldId: field.id },
              newSpellingBudget()
            );
            for (const h of hits) flagged.push(`${mod.id}.${field.id}: ${h.matchedText}`);
          }
        }
      }
    }
    expect(flagged).toEqual([]);
  });

  it("uses American spelling", () => {
    // "colour" shipped to a Knoxville practice.
    const british = /\b(?:colour|behaviour|analyse|centre|licence\s+to)\b/i;
    for (const mod of ALL_MODULES) {
      for (const section of mod.sections) {
        for (const field of section.fields) {
          const texts = [field.label, field.helpText ?? ""];
          if (field.type === "text" || field.type === "textarea") {
            texts.push(...(field.standardPhrases ?? []));
          }
          for (const t of texts) expect(british.test(t), `${mod.id}.${field.id}: ${t}`).toBe(false);
        }
      }
    }
  });
});

describe("Standardize never manufactures a finding", () => {
  it("does not flag the wording it just wrote", () => {
    // The standardizer expands tx -> treatment, and the stigmatizing rule fires
    // on "refused treatment". So "Refused tx." audited clean, the clinician
    // pressed the button the app offers, and the panel then criticised words
    // the user never typed. Flagging the shorthand form too makes the finding
    // identical on both sides of the round trip.
    for (const input of [
      "Refused tx.",
      "Refuses tx.",
      "Refused treatment.",
      "Patient refused the radiograph.",
      "Pt hx of bruxism; tx plan discussed."
    ]) {
      const before = new Set(runTextAudit(input).map((f) => f.ruleId));
      const after = runTextAudit(standardize(input).text).map((f) => f.ruleId);
      const manufactured = after.filter((id) => !before.has(id));
      expect(manufactured, `${input} manufactured ${manufactured.join(",")}`).toEqual([]);
    }
  });
});

describe("a value must match its field's type", () => {
  // composeNote switches on value.kind while the form switches on field.type.
  // When they disagreed the clinician saw an empty control and the emailed
  // record carried prose — and runMeasurementRule skipped the bounds check
  // that was the entire point of the periodontal restructure.
  it("refuses text stored against a measurement field", () => {
    const res = validateNoteState({
      selectedModuleIds: ["periodontal"],
      values: { "periodontal.ppd-max": { kind: "text", value: "6 mm generalized" } }
    });
    expect(res.ok).toBe(false);
  });

  it("refuses text stored against a tooth picker", () => {
    const res = validateNoteState({
      selectedModuleIds: ["extraction"],
      values: { "extraction.teeth": { kind: "text", value: "14" } }
    });
    expect(res.ok).toBe(false);
  });

  it("still accepts every correct pairing", () => {
    expect(
      validateNoteState({
        selectedModuleIds: ["periodontal"],
        values: {
          "periodontal.ppd-max": { kind: "measurement", value: 6, unit: "mm" },
          "universal-core.visit-purpose": { kind: "text", value: "Recall." }
        }
      }).ok
    ).toBe(true);
  });
});
