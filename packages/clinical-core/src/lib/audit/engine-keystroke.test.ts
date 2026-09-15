import { describe, expect, it } from "vitest";
import { ALL_MODULES, activeModules } from "@/lib/modules";
import { composeNote } from "@/lib/compose/composeNote";
import { runAudit } from "@/lib/audit/engine";
import { __closeMatchScans, __resetCloseMatchCache } from "./rules/spelling";
import type { NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";

// The keystroke budget.
//
// performance.test.ts guards a different thing: that no pattern degrades
// superlinearly on hostile input, with a 1,000 ms ceiling. That is a
// catastrophe alarm, and a note can be far too slow to type in while passing it
// comfortably — which is exactly what happened. composeNote + runAudit run
// SYNCHRONOUSLY on every keystroke in the builder, and the close-match spelling
// scan was 79-81% of that: 46 ms of 58 ms on a loaded note, on a developer
// machine. The device a clinician actually holds is several times slower.
//
// So this file measures the thing that got out of hand — how much expensive
// work one keystroke provokes — in units that mean the same on every machine.

function loadedNote(addOnCount: number): NoteState {
  const ids = ALL_MODULES.filter((m) => !m.alwaysOn)
    .slice(0, addOnCount)
    .map((m) => m.id);
  const state: NoteState = { selectedModuleIds: ids, values: {} };
  for (const mod of activeModules(ids)) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        const key = fieldKey(mod.id, field.id);
        if (field.type === "text" || field.type === "textarea") {
          state.values[key] = {
            kind: "text",
            value:
              "The clinician observed generalized plaque and moderate calculus on the lower " +
              "anterior teeth; the patient tolerated the visit well and was advised on " +
              "brushing technique."
          };
        } else if (field.type === "select" && field.options.length > 0) {
          state.values[key] = { kind: "select", value: field.options[0].value };
        } else if (field.type === "measurement") {
          state.values[key] = { kind: "measurement", value: 3, unit: field.units[0] };
        }
      }
    }
  }
  return state;
}

function keystroke(state: NoteState) {
  const modules = activeModules(state.selectedModuleIds);
  const composed = composeNote(state, modules, { officeName: null });
  return runAudit({ note: state, modules, composedText: composed });
}

describe("a keystroke must not re-do work it has already done", () => {
  it("does the expensive scan once per distinct word, not once per field", () => {
    // The same sentence sits in every free-text field of this note, which is
    // what a real note looks like after copy-forward and standard phrases. The
    // scan is a pure function of a static lexicon, so the second field that
    // contains a word has nothing left to compute.
    const state = loadedNote(8);
    __resetCloseMatchCache();
    keystroke(state);
    const first = __closeMatchScans();
    expect(first).toBeGreaterThan(0); // the note really does exercise the rule

    keystroke(state);
    expect(__closeMatchScans()).toBe(first); // second keystroke: nothing new
  });

  it("holds while the note grows, so a long visit does not get slower to type in", () => {
    // Adding modules adds fields, and the fields repeat the practice's
    // vocabulary. Scans must track DISTINCT WORDS, which plateau, rather than
    // field count, which does not.
    __resetCloseMatchCache();
    keystroke(loadedNote(4));
    const afterFour = __closeMatchScans();
    keystroke(loadedNote(31));
    const afterAll = __closeMatchScans();
    // The full 31-module note introduces new vocabulary, so some growth is
    // real. What must not happen is growth in proportion to the eightfold
    // increase in fields.
    expect(afterAll).toBeLessThan(afterFour * 4);
  });

  it("never spends more than the documented budget in a single audit", () => {
    // The budget is the backstop for a note stuffed with unique junk words:
    // work degrades to "no close-match suggestions" instead of blocking the
    // main thread. Proven here on input designed to defeat the cache.
    const state: NoteState = { selectedModuleIds: [], values: {} };
    const junk = Array.from({ length: 5000 }, (_, i) => `qwertyz${i}zx`).join(" ");
    state.values["universal-core.visit-purpose"] = { kind: "text", value: junk };
    __resetCloseMatchCache();
    keystroke(state);
    // DEFAULT_CLOSE_CHECKS is 1,500 per run and every attempt is charged.
    expect(__closeMatchScans()).toBeLessThanOrEqual(1500);
  });

  it("stays under a generous wall-clock ceiling on a full note", () => {
    // Loose on purpose — a CI runner is not a clinician's tablet and this
    // number cannot be tightened without flaking. It catches a blowup in
    // something the work count above does not see, and nothing subtler.
    const state = loadedNote(31);
    keystroke(state); // warm
    const start = performance.now();
    for (let i = 0; i < 5; i++) keystroke(state);
    expect((performance.now() - start) / 5).toBeLessThan(150);
  });
});
