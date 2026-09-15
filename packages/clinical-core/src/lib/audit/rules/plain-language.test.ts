import { describe, expect, it } from "vitest";
import { runPlainLanguageRule } from "./plain-language";
import { runAudit, runTextAudit } from "@/lib/audit/engine";
import { ALL_MODULES, activeModules } from "@/lib/modules";
import { composeNote } from "@/lib/compose/composeNote";
import { PLAIN_WORDS } from "@/lib/vocab/plain-language";
import type { NoteState } from "@/lib/schema/types";

const REF = { moduleId: "universal-core", fieldId: "patient-summary" };
const ids = (text: string) => runPlainLanguageRule(text, REF).map((f) => f.ruleId);

describe("plain language, in text written for the patient", () => {
  it("flags the clinical word", () => {
    expect(ids("We took a radiograph of the upper left.")).toContain("plain.radiograph");
    expect(ids("You have periodontitis.")).toContain("plain.periodontitis");
    expect(ids("The extraction went well.")).toContain("plain.extraction");
  });

  it("is always STYLE, never a block, and points at its field", () => {
    for (const f of runPlainLanguageRule("Caries in the maxillary anterior.", REF)) {
      expect(f.severity).toBe("S3");
      expect(f.category).toBe("plain-language");
      expect(f.fieldRef).toEqual(REF);
    }
  });

  it("stays quiet once the writer explains the term", () => {
    // The house standard: keep the clinical word, explain it once. Flagging
    // this would push a writer to DELETE the explanation to clear the finding.
    expect(ids("You have periodontitis (gum disease that has reached the bone).")).toEqual([]);
    expect(ids("We took a radiograph (an x-ray picture of the tooth).")).toEqual([]);
  });

  it("accepts the other order too — plain word first, term in brackets", () => {
    expect(ids("You have gum disease (periodontitis).")).toEqual([]);
  });

  it("does not count a bare bracket as an explanation", () => {
    // "(3)" after a term is a tooth number, not a definition.
    expect(ids("The extraction (3) is healing.")).toContain("plain.extraction");
  });

  it("counts occurrences rather than repeating the finding", () => {
    const found = runPlainLanguageRule("radiograph, then another radiograph", REF);
    expect(found).toHaveLength(1);
    expect(found[0].occurrences).toBe(2);
  });

  it("suggests both ways out: the plain word, or the term explained once", () => {
    const [f] = runPlainLanguageRule("periodontitis", REF);
    expect(f.suggestion).toContain("gum disease that has reached the bone");
    expect(f.suggestion).toContain("periodontitis (");
  });
});

describe("the record voice is never touched by the patient rule", () => {
  it("no plain.* finding can escape through runTextAudit", () => {
    // runTextAudit sees the WHOLE composed note, where "radiograph" and
    // "periodontitis" are the correct words. If the plain rule ever reached it,
    // an ordinary clinical note would carry dozens of style rows telling the
    // clinician to stop writing like a clinician.
    const clinical =
      "Radiograph of the maxillary anterior shows caries. Periodontitis with " +
      "erythema and exudate. Extraction and suture placed under local anesthetic. " +
      "Prophylaxis and scaling and root planing completed. Prior to discharge the " +
      "clinician administered an analgesic.";
    const escaped = runTextAudit(clinical).filter((f) => f.ruleId.startsWith("plain."));
    expect(escaped).toEqual([]);
  });

  it("runAudit leaves a clinical field alone and checks the patient field", () => {
    const note: NoteState = {
      selectedModuleIds: [],
      values: {
        // Clinical voice: correct as written, must draw no plain finding.
        "universal-core.dentition-hard-tissue": {
          kind: "text",
          value: "Caries on the maxillary anterior."
        },
        // Patient voice: the same words, now the wrong register.
        "universal-core.patient-summary": {
          kind: "text",
          value: "You have caries on the maxillary anterior."
        }
      }
    };
    const modules = activeModules(note.selectedModuleIds);
    const report = runAudit({ note, modules, composedText: composeNote(note, modules) });
    const plain = report.findings.filter((f) => f.category === "plain-language");
    expect(plain.length).toBeGreaterThan(0);
    for (const f of plain) expect(f.fieldRef?.fieldId).toBe("patient-summary");
  });
});

describe("the two lists never argue in front of the clinician", () => {
  const build = (values: NoteState["values"]) => {
    const note: NoteState = { selectedModuleIds: [], values };
    const modules = activeModules([]);
    return runAudit({ note, modules, composedText: composeNote(note, modules) });
  };

  it("drops the auto-applicable abbreviation when the word is only in the patient text", () => {
    // abbrev.xray is severityClass "style": one deterministic replacement,
    // "x-ray" -> "radiograph". In the patient summary that is a one-click
    // jargon generator, and the plain rule is at the same moment asking for the
    // reverse. Showing both would leave the writer no way to satisfy the tool.
    const report = build({
      "universal-core.patient-summary": {
        kind: "text",
        value: "We took an x-ray of the sore tooth."
      }
    });
    expect(report.findings.map((f) => f.ruleId)).not.toContain("abbrev.xray");
  });

  it("keeps it when the clinical half of the note uses the word too", () => {
    // There the finding really is about the record, and suppressing it would
    // hide a genuine one behind an unrelated field.
    const report = build({
      "universal-core.images": { kind: "text", value: "x-ray taken of tooth 3." },
      "universal-core.patient-summary": {
        kind: "text",
        value: "We took an x-ray of the sore tooth."
      }
    });
    expect(report.findings.map((f) => f.ruleId)).toContain("abbrev.xray");
  });

  it("leaves REVIEW abbreviations alone even in patient text", () => {
    // Only the auto-applicable STYLE class is suppressed. A REVIEW item hides a
    // clinical fact, and it hides it just as thoroughly from the patient.
    const report = build({
      "universal-core.patient-summary": { kind: "text", value: "Your BW showed nothing new." }
    });
    expect(report.findings.map((f) => f.ruleId)).toContain("abbrev.bw");
  });

  it("changes nothing at all for a note with no patient text", () => {
    const report = build({
      "universal-core.images": { kind: "text", value: "x-ray taken of tooth 3." }
    });
    expect(report.findings.map((f) => f.ruleId)).toContain("abbrev.xray");
  });
});

describe("the app's own patient-facing wording passes its own rule", () => {
  it("no supplied phrase or hint on a patient field trips the plain rule", () => {
    const flagged: string[] = [];
    for (const mod of ALL_MODULES) {
      for (const section of mod.sections) {
        for (const field of section.fields) {
          if (field.audience !== "patient") continue;
          const texts = [field.label];
          if (field.type === "text" || field.type === "textarea") {
            texts.push(...(field.standardPhrases ?? []), field.placeholderHint ?? "");
          }
          for (const t of texts) {
            for (const f of runPlainLanguageRule(t, { moduleId: mod.id, fieldId: field.id })) {
              flagged.push(`${mod.id}.${field.id}: "${t}" -> ${f.ruleId}`);
            }
          }
        }
      }
    }
    expect(flagged).toEqual([]);
  });

  it("ships at least one field written for the patient", () => {
    // Without this the dogfood above passes vacuously the day someone drops the
    // audience marker.
    const patientFields = ALL_MODULES.flatMap((m) =>
      m.sections.flatMap((s) => s.fields.filter((f) => f.audience === "patient"))
    );
    expect(patientFields.length).toBeGreaterThan(0);
  });

  it("has a unique id and a real replacement for every plain word", () => {
    const idList = PLAIN_WORDS.map((w) => w.id);
    expect(new Set(idList).size).toBe(idList.length);
    for (const w of PLAIN_WORDS) {
      expect(w.replacement.trim().length, w.id).toBeGreaterThan(0);
      expect(w.pattern.flags, w.id).toContain("g");
    }
  });

  it("names, in the staff table, every word its own pattern fires on", () => {
    // The parity test compares TERM SETS between the code and the staff
    // markdown. It cannot see inside a pattern — so an entry displayed as
    // "initiate" whose regex also matched "commence" passed parity while
    // correcting staff by a rule they were never shown. That is the direction
    // the parity test's own comment calls the worse one.
    //
    // This checks the other half: every "/"-separated term in the display must
    // actually match the pattern, so a display and its regex cannot drift apart
    // in either direction without a red test.
    const missing: string[] = [];
    for (const w of PLAIN_WORDS) {
      for (const term of w.display.split("/").map((t) => t.trim())) {
        const fresh = new RegExp(w.pattern.source, w.pattern.flags);
        if (!fresh.test(term)) missing.push(`${w.id}: display says "${term}" but the pattern ignores it`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("still fires on the variants the table now lists", () => {
    // The concrete regressions. Each of these was a live pattern match that the
    // staff table did not mention until it was named in the display.
    const cases: Array<[string, string]> = [
      ["commence treatment", "plain.initiate"],
      ["at this time", "plain.at-this-point-in-time"],
      ["anesthesia given", "plain.anesthetic"],
      ["necrosis of the pulp", "plain.necrotic"],
      ["occlusal wear", "plain.occlusion"],
      ["the maxilla", "plain.maxillary"],
      ["the mandible", "plain.mandibular"],
      ["pulpitis", "plain.pulp"],
      ["oedema", "plain.edema"],
      ["aetiology", "plain.etiology"]
    ];
    for (const [text, ruleId] of cases) {
      expect(ids(text), text).toContain(ruleId);
    }
  });

  it("does not fire on a fragment that is not a word", () => {
    // `/\bextraction?s?\b/` parsed as "extractio" + "n?" + "s?", so the
    // non-word "extractio" matched. Harmless in practice, and a sign the
    // pattern said something other than what it meant.
    expect(ids("extractio")).toEqual([]);
    expect(ids("extract the file")).toEqual([]);
    expect(ids("extraction")).toContain("plain.extraction");
    expect(ids("extractions")).toContain("plain.extraction");
  });
});
