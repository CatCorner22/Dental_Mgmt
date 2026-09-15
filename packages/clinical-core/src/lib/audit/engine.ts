import type {
  AuditContext,
  AuditFinding,
  AuditGates,
  AuditReport,
  OverallStatus,
  Severity
} from "./types";
import { SEVERITY_ORDER } from "./types";
import type { FieldValue, NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible } from "@/lib/schema/conditions";
import { runPhiRule } from "./rules/phi";
import { runResidueRule } from "./rules/residue";
import { runAbbreviationRule, runStigmatizingRule, runVaguePhraseRule } from "./rules/terminology";
import { runShorthandGate } from "./rules/shorthand-gate";
import { runAnaestheticDoseRule } from "./rules/anesthetic-dose";
import { runSupervisionRule } from "./rules/supervision";
import { runAnatomyStateRule, runAnatomyTextRule } from "./rules/anatomy";
import { newSpellingBudget, runSpellingRule } from "./rules/spelling";
import { runRequiredRule } from "./rules/required";
import { runMeasurementRule } from "./rules/measurement";
import { runMedicationSafetyRules } from "./rules/medication-safety";
import { runEffortRules } from "./rules/effort";
import { runCompletenessRules } from "./rules/completeness";
import { runJustificationRules } from "./rules/justification";
import { runPlainLanguageRule } from "./rules/plain-language";
import { tailorAuditFindings } from "./tailorForAuthor";

// Pure and isomorphic. The client runs the full audit live; the email route
// re-runs the text audit server-side so a tampered client cannot bypass it.

export function runTextAudit(text: string): AuditFinding[] {
  return [
    ...runPhiRule(text),
    ...runResidueRule(text),
    ...runAbbreviationRule(text),
    // The tiered filing gate. Separate from runAbbreviationRule because the two
    // answer different questions: that one advises on wording, this one decides
    // what may not be FILED. Keeping them apart is what lets "X-ray" stay a
    // style note while "10U" stops the note leaving the tool.
    ...runShorthandGate(text),
    ...runVaguePhraseRule(text),
    ...runStigmatizingRule(text),
    ...runAnatomyTextRule(text),
    ...runMedicationSafetyRules(text),
    // The first rule in the product that is only possible because the
    // transformer reads notes rather than rewriting them: a carpule count
    // carries no "mg", so no regex over milligrams can reach it.
    ...runAnaestheticDoseRule(text),
    ...runEffortRules(text),
    ...runCompletenessRules(text),
    ...runJustificationRules(text)
  ];
}

export function runAudit(ctx: AuditContext): AuditReport {
  // The patient half is collected first and cheaply — it visits only the
  // handful of fields carrying the audience marker. Most notes have none, and
  // in that case the record half is never built at all: concatenating every
  // field value in the note, on every keystroke, to answer a question whose
  // answer is already known would be the wrong kind of thorough.
  const patientVoice = collectPatientVoice(ctx.note, ctx.modules);
  const textFindings = runTextAudit(ctx.composedText);
  const raw: AuditFinding[] = [
    ...runRequiredRule(ctx.note, ctx.modules),
    ...runSupervisionRule(ctx.note, ctx.modules, ctx.today ?? new Date().toISOString().slice(0, 10)),
    ...runAnatomyStateRule(ctx.note, ctx.modules),
    ...runMeasurementRule(ctx.note, ctx.modules),
    ...(patientVoice
      ? suppressPatientVoiceStyle(textFindings, patientVoice, () =>
          collectRecordVoice(ctx.note, ctx.modules)
        )
      : textFindings),
    ...runFieldSpelling(ctx.note, ctx.modules),
    ...runPatientLanguage(ctx.note, ctx.modules)
  ];
  const findings = tailorAuditFindings(raw, ctx.clinicalRole, ctx.note, ctx.modules);
  return buildReport(findings);
}

// The plain-language rule, over patient-facing fields only.
//
// Deliberately a FIELD walk rather than part of runTextAudit. runTextAudit sees
// the whole composed note, where "radiograph" and "periodontitis" are the
// correct words — flagging them there would bury every real finding under a
// hundred style rows and would contradict the abbreviation rule, which spends
// its time putting those words IN.
function runPatientLanguage(note: NoteState, modules: AuditContext["modules"]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (field.audience !== "patient") continue;
        if (field.type !== "text" && field.type !== "textarea") continue;
        if (!isFieldVisible(field, mod.id, note)) continue;
        const value = note.values[fieldKey(mod.id, field.id)];
        if (!value || value.kind !== "text" || !value.value.trim()) continue;
        findings.push(
          ...runPlainLanguageRule(value.value, { moduleId: mod.id, fieldId: field.id })
        );
      }
    }
  }
  return findings;
}

// The words a field actually contributes to the note. Values only — never the
// labels, which are the app's own text and are held clean by the module dogfood.
function valueText(value: FieldValue): string {
  if (value.kind === "text") return value.value;
  if (value.kind === "select") return `${value.value} ${value.otherText ?? ""}`;
  if (value.kind === "multiselect") return value.values.join("\n");
  return "";
}

function collectVoice(
  note: NoteState,
  modules: AuditContext["modules"],
  wantPatient: boolean
): string {
  const parts: string[] = [];
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if ((field.audience === "patient") !== wantPatient) continue;
        if (!isFieldVisible(field, mod.id, note)) continue;
        const value = note.values[fieldKey(mod.id, field.id)];
        if (!value) continue;
        const text = valueText(value);
        if (text.trim()) parts.push(text);
      }
    }
  }
  return parts.join("\n");
}

/** Everything written for the patient. Empty string when the note has none. */
function collectPatientVoice(note: NoteState, modules: AuditContext["modules"]): string {
  return collectVoice(note, modules, true);
}

/** Everything written for the record. Only built when a patient voice exists. */
function collectRecordVoice(note: NoteState, modules: AuditContext["modules"]): string {
  return collectVoice(note, modules, false);
}

/**
 * Drop auto-applicable abbreviation findings that exist ONLY in patient-facing
 * text.
 *
 * `abbrev.xray` is severityClass "style", which in this app means one
 * deterministic replacement a staff member may apply: "x-ray" becomes
 * "radiograph". That is right for the clinical record and exactly backwards for
 * a paragraph the patient reads, where the plain-language rule is at the same
 * moment asking for "radiograph" to become "x-ray".
 *
 * Without this the panel would show both findings at once, each undoing the
 * other, and the writer would have no way to satisfy the tool. The suppression
 * is narrow on purpose: only STYLE abbreviations, and only when the matched
 * text appears nowhere in the clinical half of the note. A word used in both
 * halves keeps its finding, because there it really is about the record.
 *
 * The suppressed set holds the finding OBJECTS, not composite string keys. An
 * earlier version joined ruleId and matchedText with a separator, and the
 * separator that got committed was a literal NUL byte — which made git treat
 * this whole file as binary and refuse to merge it textually. Identity is what
 * the filter actually needs here, since every candidate came out of the array
 * being filtered, so there is no key to encode and nothing to get wrong.
 */
function suppressPatientVoiceStyle(
  findings: AuditFinding[],
  patientVoice: string,
  // Lazy: a note usually carries no STYLE abbreviation finding at all, and
  // building the record half is the expensive side of this comparison.
  recordVoice: () => string
): AuditFinding[] {
  const candidates = findings.filter(
    (f) => f.category === "abbreviation" && f.severity === "S3" && f.matchedText
  );
  if (candidates.length === 0) return findings;
  if (!candidates.some((f) => patientVoice.includes(f.matchedText!))) return findings;

  const record = recordVoice();
  const suppressed = new Set(
    candidates.filter(
      (f) => patientVoice.includes(f.matchedText!) && !record.includes(f.matchedText!)
    )
  );
  if (suppressed.size === 0) return findings;
  return findings.filter((f) => !suppressed.has(f));
}

function runFieldSpelling(note: NoteState, modules: AuditContext["modules"]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  // ONE budget across every field, so total close-match work per audit run is
  // bounded no matter how many text fields the note spreads its words across.
  const budget = newSpellingBudget();
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (field.type !== "text" && field.type !== "textarea") continue;
        if (!isFieldVisible(field, mod.id, note)) continue;
        const value = note.values[fieldKey(mod.id, field.id)];
        if (!value || value.kind !== "text" || !value.value.trim()) continue;
        findings.push(
          ...runSpellingRule(value.value, { moduleId: mod.id, fieldId: field.id }, budget)
        );
      }
    }
  }
  return findings;
}

export function buildReport(findings: AuditFinding[]): AuditReport {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
  const counts: Record<Severity, number> = { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 };
  for (const f of sorted) counts[f.severity]++;
  const phiStops = sorted.filter((f) => f.category === "phi" && f.severity === "S0");

  let status: OverallStatus;
  if (counts.S0 > 0) status = "BLOCKED";
  else if (counts.S1 > 0) status = "NEEDS CLINICIAN ACTION";
  else if (counts.S2 > 0) status = "READY FOR CLINICIAN REVIEW";
  else status = "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED";

  return { findings: sorted, counts, status, phiStops };
}

// The attestation validator moved to ./attestation.ts: pure string helpers
// that client code (the override dialog's reason codes, the resolution
// signatures) needs WITHOUT the rules-and-vocabulary cluster this module
// imports. Re-exported here so the submit route and every existing caller
// keep one import path; the two can still never disagree.
export { PHI_ATTESTATION_RULE, isValidPhiAttestation, visibleText } from "./attestation";

// phiOverridden: the user completed the explicit override dialog and attested
// that every flagged item was reviewed and none is an identifier.
export function computeGates(report: AuditReport, phiOverridden: boolean): AuditGates {
  const phiBlocked = report.phiStops.length > 0 && !phiOverridden;
  const nonPhiStops = report.counts.S0 - report.phiStops.length;
  // Any unresolved S0 stops the line: a wrong-site or invalid-tooth note must
  // not leave the tool by copy/download either, matching the finding's own
  // "correct the site before this entry leaves the tool." A PHI S0 is the one
  // stop a person can waive, via the attested override.
  const blocked = phiBlocked || nonPhiStops > 0;
  return {
    exportAllowed: !blocked,
    emailAllowed: !blocked && report.counts.S1 === 0
  };
}
