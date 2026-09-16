import { describe, expect, it } from "vitest";
import { runStigmatizingRule, runVaguePhraseRule } from "./terminology";
import { STIGMATIZING_PHRASES, VAGUE_PHRASES } from "@/lib/vocab/vague-phrases";
import { ALL_MODULES } from "@/lib/modules";

// The 21st Century Cures Act gives patients routine access to these notes.
// The audience changed; the vocabulary largely did not.
//
// Two failure modes matter here and they pull in opposite directions. Miss the
// label and the rule is pointless. Flag a legitimate clinical term and the rule
// cries wolf — and a checker that cries wolf gets muted, which costs more than
// it ever gains. Both directions are tested.

const ids = (text: string) => runStigmatizingRule(text).map((f) => f.ruleId);
const matched = (text: string) => runStigmatizingRule(text).map((f) => f.matchedText);

describe("it catches the label", () => {
  it("person-first: the condition is not the person", () => {
    expect(ids("The diabetic patient was seen for a recall.")).toContain("stigma.person-first-diabetic");
    expect(ids("Patient is a diabetic.")).toContain("stigma.person-first-diabetic");
    expect(ids("Reviewed the epileptic patient's medication.")).toContain("stigma.person-first-epileptic");
    expect(ids("Known addict.")).toContain("stigma.person-first-addict");
  });

  it("wording that tells the reader you doubt the patient", () => {
    expect(ids("Patient claims the pain started on waking.")).toContain("stigma.patient-claims");
    expect(ids("The pt alleges the crown was never cemented.")).toContain("stigma.patient-claims");
  });

  it("wording that assigns fault", () => {
    expect(ids("Patient refused the radiograph.")).toContain("stigma.patient-refused");
    expect(ids("Refused treatment at this visit.")).toContain("stigma.patient-refused");
    expect(ids("Patient failed to attend the review.")).toContain("stigma.patient-failed");
    expect(ids("Second no-show this quarter.")).toContain("stigma.no-show");
  });

  it("wording that judges rather than describes", () => {
    expect(ids("Child was uncooperative throughout.")).toContain("stigma.uncooperative");
    expect(ids("Known frequent flyer.")).toContain("stigma.frequent-flyer");
    expect(ids("Presentation is drug-seeking.")).toContain("stigma.drug-seeking");
  });
});

describe("it does NOT cry wolf", () => {
  // Every one of these is a legitimate clinical term that shares a word with a
  // rule above. Flagging any of them would train staff to ignore the panel.
  it("leaves the adjectival diagnosis alone", () => {
    expect(runStigmatizingRule("Diabetic ketoacidosis was ruled out.")).toEqual([]);
    expect(runStigmatizingRule("Signs consistent with diabetic neuropathy.")).toEqual([]);
    expect(runStigmatizingRule("Reviewed glycemic control in diabetes.")).toEqual([]);
  });

  it("leaves the app's own refusal vocabulary alone", () => {
    // "Refusal and Incomplete Care Add-On" and "Consent or refusal form status"
    // name a CATEGORY. They do not describe a person, and a rule that cannot
    // tell the difference would flag the tool's own forms.
    expect(runStigmatizingRule("Refusal and Incomplete Care Add-On")).toEqual([]);
    expect(runStigmatizingRule("Consent or refusal form status")).toEqual([]);
    expect(runStigmatizingRule("Refused, deferred, stopped, or incomplete care.")).toEqual([]);
  });

  it("leaves neutral outcome words alone", () => {
    expect(runStigmatizingRule("The patient declined the referral.")).toEqual([]);
    expect(runStigmatizingRule("The patient did not attend.")).toEqual([]);
    expect(runStigmatizingRule("The patient reports pain on biting.")).toEqual([]);
    expect(runStigmatizingRule("Restoration failed to seat; remade.")).toEqual([]);
  });

  it("does not fire on an empty or ordinary note", () => {
    expect(runStigmatizingRule("")).toEqual([]);
    expect(
      runStigmatizingRule("Prophylaxis completed. Oral hygiene instruction given. Recall six months.")
    ).toEqual([]);
  });
});

describe("it never blocks and never rewrites", () => {
  it("is STYLE severity, always", () => {
    const findings = runStigmatizingRule(
      "Patient claims the diabetic patient refused treatment and was uncooperative."
    );
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.severity).toBe("S3");
      expect(f.category).toBe("stigmatizing");
      // The replacement is offered, never applied — it depends on what actually
      // happened, and choosing it for the clinician would be inventing content.
      expect(f.suggestion).toBeTruthy();
    }
  });

  it("counts repeats instead of listing the same word over and over", () => {
    const f = runStigmatizingRule("Patient claims one thing. Patient claims another.");
    const claims = f.find((x) => x.ruleId === "stigma.patient-claims");
    expect(claims?.occurrences).toBe(2);
  });
});

describe("it does not double-flag what the vague rule already owns", () => {
  it("leaves noncompliant, patient denies, and poor historian to VAGUE_PHRASES", () => {
    // These three are already flagged at REVIEW severity, which is stronger
    // than STYLE. Listing them here too would report the same span twice and
    // downgrade nothing — it would just teach people the panel repeats itself.
    for (const text of [
      "Patient is noncompliant with hygiene advice.",
      "Patient denies pain.",
      "Poor historian."
    ]) {
      expect(runStigmatizingRule(text)).toEqual([]);
      expect(runVaguePhraseRule(text).length).toBeGreaterThan(0);
    }
  });

  it("shares no rule ids with the vague list", () => {
    const vague = new Set(VAGUE_PHRASES.map((p) => p.id));
    for (const p of STIGMATIZING_PHRASES) expect(vague.has(p.id)).toBe(false);
  });
});

describe("the app's own forms pass their own rule", () => {
  it("no module label, option, or standard phrase is stigmatizing", () => {
    // Same dogfooding the module integrity suite does for the other rules. If
    // the tool ships a form that says "patient refused", the rule is not one
    // the practice can take seriously.
    for (const mod of ALL_MODULES) {
      const texts = [mod.title, mod.description ?? ""];
      for (const section of mod.sections) {
        texts.push(section.title);
        for (const f of section.fields) {
          texts.push(f.label, f.helpText ?? "");
          if (f.type === "select" || f.type === "multiselect") {
            texts.push(...f.options.map((o) => o.label ?? o.value));
          }
          if ((f.type === "text" || f.type === "textarea") && f.standardPhrases) {
            texts.push(...f.standardPhrases);
          }
        }
      }
      for (const text of texts) {
        expect(matched(text), `${mod.id}: "${text}"`).toEqual([]);
      }
    }
  });
});
