// LOCAL ANAESTHETIC DOSE — the arithmetic a dental note never writes down.
//
// ===========================================================================
// WHY THIS COULD NOT EXIST BEFORE THE EXTRACTOR
//
// `runDoseArithmeticRule` already checks a writer's own arithmetic, but only
// when the note states a weight in kilograms, a mg/kg figure AND a total in
// milligrams. A dental anaesthetic line states none of those. It says:
//
//     "2 carp lido 2% w epi 1:100k"
//
// There is no "mg" anywhere in it, so no regex over milligrams can see it. The
// dose is implied by three separate conventions — a carpule is 1.8 mL, a 2%
// solution is 20 mg/mL, and 1:100,000 epinephrine is 0.01 mg/mL — and getting
// from the text to a number requires the structured facts the extractor now
// produces. This is the first capability in the product that is only possible
// because the transformer reads notes rather than rewriting them.
// ===========================================================================
//
// THE POSTURE, WHICH MATTERS MORE THAN THE ARITHMETIC.
//
// This rule is S2 (REVIEW). It never blocks filing, and that is a deliberate
// safety decision rather than caution.
//
// A clinical note is a RECORD. If a clinician administered more than the
// published maximum, the note MUST say so — that is exactly the encounter where
// the record matters most, to the patient, to the practice and to anyone
// reviewing it afterwards. A gate that refused to file such a note would
// suppress the documentation of the event it was worried about, and would teach
// staff to under-record doses to get the note out. The failure mode of blocking
// here is worse than the failure mode of advising.
//
// So it says what it computed, shows the working, and asks. It does not stop
// anyone.
//
// IT ALSO ONLY FIRES ON EXCEEDANCE, never on "approaching a limit". A checker
// that warns at 80% of a maximum fires on ordinary care, and the override
// arithmetic is unforgiving — repeated alerts are overridden 12 points harder
// than first-time ones.

import type { AuditFinding } from "../types";
import { extractFacts } from "@/lib/extract/extract";
import type { MeasurementFact, MedicationFact } from "@/lib/extract/facts";

/**
 * Published maximum recommended doses for dental local anaesthetics.
 *
 * Figures are the widely published manufacturer / Malamed values used in US
 * dental practice. They are a REVIEW THRESHOLD, not a clinical instruction:
 * the safe dose for a given patient depends on age, weight, hepatic and
 * cardiac status and the procedure, and only the treating clinician holds
 * those facts. The rule's job is to notice that a number crossed a published
 * line and say so with the working shown.
 *
 * `mgPerKg` is the weight-based limit; `absoluteMaxMg` is the ceiling that
 * applies however heavy the patient is.
 */
interface AnaestheticLimit {
  drug: string;
  mgPerKg: number;
  absoluteMaxMg: number;
}

export const ANAESTHETIC_LIMITS: AnaestheticLimit[] = [
  { drug: "lidocaine", mgPerKg: 4.4, absoluteMaxMg: 300 },
  { drug: "articaine", mgPerKg: 7.0, absoluteMaxMg: 500 },
  { drug: "mepivacaine", mgPerKg: 4.4, absoluteMaxMg: 300 },
  { drug: "prilocaine", mgPerKg: 6.0, absoluteMaxMg: 400 },
  { drug: "bupivacaine", mgPerKg: 1.3, absoluteMaxMg: 90 }
];

const LIMIT_BY_DRUG = new Map(ANAESTHETIC_LIMITS.map((l) => [l.drug, l]));

/**
 * Milligrams delivered, from a volume and a percentage.
 *
 * A percentage solution is grams per 100 mL, so 2% is 20 mg/mL. This is the
 * conversion the whole rule rests on and it is exact — no clinical judgement,
 * no assumption about what the writer meant.
 */
export function milligramsFrom(volumeMl: number, concentrationPercent: number): number {
  return volumeMl * concentrationPercent * 10;
}

/** Epinephrine mg from a volume and a 1:N ratio. 1:100,000 is 0.01 mg/mL. */
export function epinephrineMg(volumeMl: number, ratioDenominator: number): number {
  return (volumeMl * 1000) / ratioDenominator;
}

/**
 * The cardiac-patient epinephrine ceiling.
 *
 * 0.04 mg is the figure quoted for a patient with significant cardiovascular
 * disease; 0.2 mg is the healthy-patient figure. Only the higher one is
 * enforced here, because this rule cannot know the patient's cardiac status and
 * firing the 0.04 mg limit on every healthy adult would be the definition of
 * crying wolf.
 */
export const EPINEPHRINE_MAX_MG = 0.2;

interface DoseTotal {
  drug: string;
  mg: number;
  /** Human-readable working, so a clinician can check rather than trust. */
  working: string[];
}

/**
 * Sum each anaesthetic across the note.
 *
 * ONLY facts that carry BOTH a volume and a concentration are counted. "2 carp
 * lido" with no percentage is un-computable — the writer did not say how strong
 * the solution was — and assuming the common 2% would be inventing a clinical
 * number. An un-computable dose contributes nothing and is reported separately
 * as a gap in the note, which is the honest handling.
 */
function totalsByDrug(meds: MedicationFact[]): { totals: DoseTotal[]; uncomputable: MedicationFact[] } {
  const byDrug = new Map<string, DoseTotal>();
  const uncomputable: MedicationFact[] = [];

  for (const med of meds) {
    if (!LIMIT_BY_DRUG.has(med.drug)) continue;
    if (med.assertion.polarity !== "affirmed") continue;
    // A planned or historical dose is not a dose given today.
    if (med.assertion.temporalityHint) continue;

    if (med.volumeMl === undefined || med.concentrationPercent === undefined) {
      uncomputable.push(med);
      continue;
    }
    const mg = milligramsFrom(med.volumeMl, med.concentrationPercent);
    const entry = byDrug.get(med.drug) ?? { drug: med.drug, mg: 0, working: [] };
    entry.mg += mg;
    entry.working.push(
      `${med.volumeMl} mL at ${med.concentrationPercent}% = ${Math.round(mg * 10) / 10} mg`
    );
    byDrug.set(med.drug, entry);
  }

  return { totals: [...byDrug.values()], uncomputable };
}

/** The documented weight, in kilograms, if the note states one. */
function documentedWeightKg(measurements: MeasurementFact[]): number | undefined {
  const kg = measurements
    .filter((m) => m.unit === "kg" && m.assertion.polarity === "affirmed")
    .map((m) => m.amount);
  // The largest, on the same reasoning runDoseArithmeticRule uses: if a note
  // mentions more than one weight, the conservative reading for a MAXIMUM is
  // the one that permits the most, so a finding raised against it is a finding
  // that would hold whichever number the writer meant.
  return kg.length > 0 ? Math.max(...kg) : undefined;
}

export function runAnaestheticDoseRule(text: string): AuditFinding[] {
  const facts = extractFacts(text).facts;
  const meds = facts.filter((f): f is MedicationFact => f.kind === "medication");
  if (meds.length === 0) return [];

  const measurements = facts.filter((f): f is MeasurementFact => f.kind === "measurement");
  const weightKg = documentedWeightKg(measurements);
  const { totals, uncomputable } = totalsByDrug(meds);
  const findings: AuditFinding[] = [];

  for (const total of totals) {
    const limit = LIMIT_BY_DRUG.get(total.drug)!;
    const mg = Math.round(total.mg * 10) / 10;
    const weightLimit = weightKg !== undefined ? limit.mgPerKg * weightKg : undefined;
    // The binding limit is whichever is LOWER: a 20 kg child's ceiling is the
    // weight-based one, an adult's is the absolute.
    const applicable =
      weightLimit !== undefined ? Math.min(weightLimit, limit.absoluteMaxMg) : limit.absoluteMaxMg;

    if (mg <= applicable) continue;

    const basis =
      weightLimit !== undefined && weightLimit < limit.absoluteMaxMg
        ? `${limit.mgPerKg} mg/kg at the documented ${weightKg} kg = ${Math.round(weightLimit * 10) / 10} mg`
        : `the published maximum of ${limit.absoluteMaxMg} mg`;

    findings.push({
      ruleId: `dose.anaesthetic-max.${total.drug}`,
      category: "medication-safety",
      severity: "S2",
      message:
        `This note records ${mg} mg of ${total.drug} (${total.working.join(" + ")}), ` +
        `which is above ${basis}. If that is what was given, the note should say why. ` +
        `If the carpule count or concentration is wrong, correct it.`,
      matchedText: total.drug,
      occurrences: total.working.length
    });
  }

  // EPINEPHRINE IS NOT CHECKED HERE YET, and the reason is worth recording
  // rather than leaving as an absence.
  //
  // In "2 carp lido 2% w epi 1:100k" the epinephrine shares the anaesthetic's
  // carpule — the volume is the same 3.6 mL — but the extractor does not link
  // the two facts, and it does not capture the 1:100,000 ratio at all (the
  // tokenizer sees "1", ":", "100", "k"). So a check written today would read
  // a volume of zero and silently never fire.
  //
  // A rule that cannot fire is worse than a missing rule: it appears in the
  // ruleset, it passes review, and everyone believes the ceiling is being
  // watched. `epinephrineMg` and EPINEPHRINE_MAX_MG below are kept and tested
  // so the arithmetic is ready when the extractor can supply the inputs.

  // AN INCOMPLETE DOSE IS SILENT, and that is a deliberate retreat from a
  // finding this rule used to raise.
  //
  // It reported "the dose cannot be worked out from this note" whenever a
  // medication fact lacked a volume or a concentration. On a real training
  // note reading "Lidocaine 2% with epinephrine 1:100,000, 2 carpules" it fired
  // — because the carpule count sits after a comma, in the next clause, where
  // the clause-scoped reader cannot see it. The note stated everything; the
  // extractor could not assemble it, and the rule blamed the writer.
  //
  // That is the worst kind of false positive: confidently wrong about a
  // complete note. Until the extractor can link a dose to a drug across a
  // clause boundary, the honest behaviour is to compute nothing and say
  // nothing. `uncomputable` is kept because the count is a useful signal for
  // where the extractor needs to improve, not for what the writer should fix.
  void uncomputable;

  return findings;
}
