import { describe, expect, it } from "vitest";
import { checkScope, dentistOwnedKeys } from "./scopeGuard";
import { activeModules } from "@/lib/modules";
import { canRecordClinicalJudgement } from "@/lib/auth/clinicalRoles";
import type { NoteState } from "./types";

// Tennessee reserves diagnosis and treatment planning to the dentist. A
// hygienist may record findings FOR diagnosis by the dentist; an assistant may
// document what they did and saw. Neither may author the judgement.
//
// This is a scope-of-practice rule, not a seniority one — which is why it lives
// on its own axis and touches none of the administrative capability matrix.

const modules = activeModules([]);
const note = (values: Record<string, unknown>): NoteState =>
  ({ selectedModuleIds: [], values }) as NoteState;

const DIAGNOSIS = "universal-core.diagnosis";
const PURPOSE = "universal-core.visit-purpose";

describe("who may record clinical judgement", () => {
  it("dentist may; assistant and hygienist may not", () => {
    expect(canRecordClinicalJudgement("dentist")).toBe(true);
    expect(canRecordClinicalJudgement("assistant")).toBe(false);
    expect(canRecordClinicalJudgement("hygienist")).toBe(false);
  });

  it("UNSET may — and that default is load-bearing", () => {
    // Every existing account starts here, so turning this on restricts nobody
    // until the practice records who is who. A tool that locked half a dental
    // office out of their own notes on the morning it shipped would be switched
    // off by lunchtime. "We have not been told" is also not grounds to refuse
    // someone their work.
    expect(canRecordClinicalJudgement("unset")).toBe(true);
  });
});

describe("which fields are owned", () => {
  it("covers Assessment and Plan, derived from the modules themselves", () => {
    const keys = dentistOwnedKeys(modules);
    expect(keys.has(DIAGNOSIS)).toBe(true);
    expect(keys.has("universal-core.diagnosis-status")).toBe(true);
    expect(keys.has("universal-core.recommended-care")).toBe(true);
  });

  it("does NOT cover objective findings", () => {
    // A hygienist measuring pocket depths and writing down what they see is the
    // hygienist doing their job. Blocking that would make the tool unusable for
    // the people who use it most, and it is not what the rule says.
    const keys = dentistOwnedKeys(modules);
    expect(keys.has(PURPOSE)).toBe(false);
    expect(keys.has("universal-core.extraoral")).toBe(false);
    expect(keys.has("universal-core.allergies-status")).toBe(false);
  });
});

describe("the guard compares CHANGE, not presence", () => {
  // The single most important behaviour here. The client autosaves the WHOLE
  // note on every keystroke, dentist-owned fields included. If this rejected
  // requests that merely CARRY a diagnosis, a note the dentist had already
  // assessed would become permanently unsaveable for the hygienist working on
  // the rest of it — and their work would be lost, which is a worse outcome
  // than the one the rule is protecting against.
  const assessed = note({ [DIAGNOSIS]: { kind: "text", value: "Irreversible pulpitis, tooth 14." } });

  it("lets a hygienist save a note that already contains a dentist's diagnosis", () => {
    const edited = note({
      ...assessed.values,
      [PURPOSE]: { kind: "text", value: "Recall and prophylaxis." }
    });
    const v = checkScope("hygienist", modules, edited, assessed);
    expect(v.ok).toBe(true);
    expect(v.blocked).toEqual([]);
  });

  it("refuses a hygienist AUTHORING a diagnosis", () => {
    const v = checkScope("hygienist", modules, assessed, note({}));
    expect(v.ok).toBe(false);
    expect(v.blocked).toContain(DIAGNOSIS);
    expect(v.message).toContain("dentist records the diagnosis");
  });

  it("refuses an assistant CHANGING a dentist's diagnosis", () => {
    const rewritten = note({ [DIAGNOSIS]: { kind: "text", value: "Reversible pulpitis." } });
    expect(checkScope("assistant", modules, rewritten, assessed).ok).toBe(false);
  });

  it("refuses DELETING a diagnosis too", () => {
    // Removing a diagnosis is as much an act of clinical judgement as writing
    // one, and is the more dangerous direction.
    expect(checkScope("hygienist", modules, note({}), assessed).ok).toBe(false);
  });

  it("lets a dentist do all of it", () => {
    expect(checkScope("dentist", modules, assessed, note({})).ok).toBe(true);
    expect(checkScope("dentist", modules, note({}), assessed).ok).toBe(true);
  });

  it("lets an unset account do all of it", () => {
    expect(checkScope("unset", modules, assessed, note({})).ok).toBe(true);
  });
});

describe("prose cannot route around the guard", () => {
  // The narrative fields exist so a note can be written in sentences. That is
  // also the shape in which a diagnosis could most easily have slipped past
  // every check: a paragraph in a free-text field, on a note whose structured
  // Assessment is untouched.
  //
  // The reason it cannot is placement, not a new rule. The assessment and plan
  // narratives are fields INSIDE the dentist-owned sections, so dentistOwnedKeys
  // picks them up from the module definitions the same way it picks up the
  // diagnosis — and the scope lock, the audit tailoring and the filing check all
  // inherit that without knowing anything about narrative fields.
  const ASSESSMENT_PROSE = "universal-core.narrative-assessment";
  const PLAN_PROSE = "universal-core.narrative-plan";

  it("owns the assessment and plan narratives", () => {
    const keys = dentistOwnedKeys(modules);
    expect(keys.has(ASSESSMENT_PROSE)).toBe(true);
    expect(keys.has(PLAN_PROSE)).toBe(true);
  });

  it("leaves the safety, subjective and objective narratives to everyone", () => {
    // An auxiliary describing what they saw and what the patient said is the
    // auxiliary doing their job, in prose instead of in boxes.
    const keys = dentistOwnedKeys(modules);
    expect(keys.has("universal-core.narrative-safety")).toBe(false);
    expect(keys.has("universal-core.narrative-subjective")).toBe(false);
    expect(keys.has("universal-core.narrative-objective")).toBe(false);
  });

  it("refuses a hygienist writing a diagnosis as a sentence", () => {
    const prose = note({
      [ASSESSMENT_PROSE]: {
        kind: "text",
        value: "Irreversible pulpitis with symptomatic apical periodontitis."
      }
    });
    expect(checkScope("hygienist", modules, prose, note({})).ok).toBe(false);
  });

  it("refuses an assistant writing a plan as a sentence", () => {
    const prose = note({
      [PLAN_PROSE]: { kind: "text", value: "Extract and place a fixed partial denture." }
    });
    expect(checkScope("assistant", modules, prose, note({})).ok).toBe(false);
  });

  it("lets a hygienist write the narrative that is theirs to write", () => {
    const prose = note({
      "universal-core.narrative-objective": {
        kind: "text",
        value: "Generalized probing depths of 2 to 3 millimetres with no bleeding on probing."
      },
      "universal-core.narrative-subjective": {
        kind: "text",
        value: "The patient reports cold sensitivity on the upper left."
      }
    });
    expect(checkScope("hygienist", modules, prose, note({})).ok).toBe(true);
  });
});
