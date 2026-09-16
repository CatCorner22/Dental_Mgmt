import type { AuditFinding, Severity } from "../types";

// The Mockingbird gates: the checks that stop a note from proceeding when the
// medication content, as written, matches a documented pattern of serious
// harm. Named for what happens when nobody stops the line.
//
// THE HARD BOUNDARY, same as plausibility.ts and not negotiable: nothing in
// this file computes, converts, or suggests a dose, and nothing here gives
// prescribing advice. Every finding says "this combination or construct is a
// documented error pattern — a clinician confirms it or fixes it." The moment
// a documentation tool proposes a dose or a drug decision it is a clinical
// decision-support system with a different regulatory posture.
//
// Sources for the patterns (cited in the message so staff learn WHY, not just
// WHAT — a rule whose reason is visible is a rule that gets respected):
//  - Joint Commission Sentinel Event Alert 39 / ISMP: weigh and dose in
//    kilograms; the lb-as-kg confusion is a documented 2.2x overdose path.
//  - Pediatric dosing literature: tenfold errors from misplaced decimals;
//    household spoons vs oral syringes.
//  - SDCEP Drug Prescribing for Dentistry + peer-reviewed dental
//    pharmacology: the short list of interactions that recur in dental
//    prescribing (warfarin, lithium, epinephrine with non-selective
//    beta-blockers, statins with macrolides/azoles).

// ---------------------------------------------------------------------------
// Weight units: the kilogram rule.

const LB_WEIGHT = /\b\d+(?:\.\d+)?\s*(?:lbs?|pounds?)\b/gi;
const MG_PER_KG = /\b\d+(?:\.\d+)?\s*mg\s*\/\s*kg\b/gi;
const KG_WEIGHT = /\b(\d+(?:\.\d+)?)\s*kg\b/gi;

export function runWeightUnitRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const lbMatches = text.match(LB_WEIGHT) ?? [];
  const perKgMatches = text.match(MG_PER_KG) ?? [];

  if (lbMatches.length > 0 && perKgMatches.length > 0) {
    findings.push({
      ruleId: "medsafe.lb-with-mg-per-kg",
      category: "medication-safety",
      severity: "S1",
      message:
        `A weight in pounds ("${lbMatches[0]}") appears in the same note as a per-kilogram dose ` +
        `("${perKgMatches[0]}"). Treating a pounds value as kilograms is the most common ` +
        `weight-based dosing error and more than doubles the dose. This note cannot state a ` +
        `per-kilogram dose against a pounds weight.`,
      matchedText: lbMatches[0],
      suggestion:
        "Record the weight in kilograms (Joint Commission Sentinel Event Alert 39; ISMP), state " +
        "which weight the dose was calculated from, and remove the pounds figure or mark it as " +
        "the patient-stated value.",
      occurrences: lbMatches.length
    });
  } else if (lbMatches.length > 0 && /\b\d+(?:\.\d+)?\s*mg\b/i.test(text)) {
    findings.push({
      ruleId: "medsafe.lb-weight-with-dose",
      category: "medication-safety",
      severity: "S2",
      message:
        `A weight in pounds ("${lbMatches[0]}") appears in a note that also records a drug dose. ` +
        `Dosing weights are recorded in kilograms so a later reader cannot mistake the basis.`,
      matchedText: lbMatches[0],
      suggestion: "Record the weight in kilograms, or state explicitly that no dose was weight-based.",
      occurrences: lbMatches.length
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Dose arithmetic: the numbers must reconcile.
//
// Fires ONLY when the note states all three of: a weight in kg, a
// per-kilogram dose, and a total dose in mg — and the total exceeds double
// what the stated basis could produce for a full day. Double, because this is
// a detector for the lb-as-kg confusion (2.2x) and tenfold decimal errors,
// not a formulary; a bound tight enough to catch a plausible-but-wrong dose
// would also fire on legitimate regimens, and a checker that cries wolf gets
// dismissed. The finding never states the expected number: computing a dose,
// even to disagree with one, is the boundary this module does not cross.

export function runDoseArithmeticRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const kg = [...text.matchAll(new RegExp(KG_WEIGHT.source, "gi"))].map((m) => parseFloat(m[1]));
  const perKg = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*mg\s*\/\s*kg\b/gi)].map((m) =>
    parseFloat(m[1])
  );
  if (kg.length === 0 || perKg.length === 0) return findings;

  // Totals: mg amounts that are not themselves the per-kg figure.
  const totals: number[] = [];
  for (const m of text.matchAll(/\b(\d+(?:\.\d+)?)\s*mg\b(?!\s*\/\s*kg)/gi)) {
    totals.push(parseFloat(m[1]));
  }
  if (totals.length === 0) return findings;

  const weight = Math.max(...kg);
  const basis = Math.max(...perKg);
  const ceiling = basis * weight * 2; // full-day dose, doubled — generous by design
  const offenders = totals.filter((t) => t > ceiling);
  if (offenders.length > 0) {
    findings.push({
      ruleId: "medsafe.dose-does-not-reconcile",
      category: "medication-safety",
      severity: "S1",
      message:
        `The stated total dose ("${offenders[0]} mg") is more than double what the stated ` +
        `per-kilogram basis and weight could produce for a full day. The three numbers in this ` +
        `note do not agree, which is the signature of a pounds-as-kilograms or misplaced-decimal ` +
        `error.`,
      matchedText: `${offenders[0]} mg`,
      suggestion:
        "Recheck the weight, the per-kilogram basis, and the total against the source record. " +
        "This tool will not state which number is wrong — only the prescriber knows.",
      occurrences: offenders.length
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Household units: spoons are not measures.

const HOUSEHOLD_UNIT = /\b(?:teaspoons?|tsp|tablespoons?|tbsp)\b\.?/gi;

export function runHouseholdUnitRule(text: string): AuditFinding[] {
  const matches = text.match(HOUSEHOLD_UNIT) ?? [];
  if (matches.length === 0) return [];
  return [
    {
      ruleId: "medsafe.household-units",
      category: "medication-safety",
      severity: "S2",
      message:
        `Liquid medication instructions use a household unit ("${matches[0]}"). Household spoons ` +
        `vary two-fold in volume and are a documented source of pediatric dosing error.`,
      matchedText: matches[0],
      suggestion: "State the volume in millilitres and instruct use of an oral syringe or dosing cup.",
      occurrences: matches.length
    }
  ];
}

// ---------------------------------------------------------------------------
// Mixed measurement systems in one note.

export function runMixedUnitsRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const hasKg = /\b\d+(?:\.\d+)?\s*kg\b/i.test(text);
  const hasLb = /\b\d+(?:\.\d+)?\s*(?:lbs?|pounds?)\b/i.test(text);
  if (hasKg && hasLb) {
    findings.push({
      ruleId: "medsafe.mixed-weight-units",
      category: "medication-safety",
      severity: "S2",
      message:
        "This note records weight in both kilograms and pounds. Two figures for one fact is how " +
        "the wrong one gets used downstream.",
      suggestion:
        "Keep the kilogram value (the dosing standard) and remove the other, or label it " +
        "explicitly as the patient-stated weight.",
      occurrences: 1
    });
  }
  const hasMetricLength = /\b\d+(?:\.\d+)?\s*(?:mm|cm)\b/i.test(text);
  const hasImperialLength = /\b\d+(?:\.\d+)?\s*(?:inch(?:es)?|in\.)\s/i.test(text);
  if (hasMetricLength && hasImperialLength) {
    findings.push({
      ruleId: "medsafe.mixed-length-units",
      category: "medication-safety",
      severity: "S2",
      message: "This note mixes millimetres/centimetres with inches. Clinical measurements use one system.",
      suggestion: "Restate the imperial measurement in millimetres or centimetres.",
      occurrences: 1
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Drug interaction screens.
//
// A curated short list, not a formulary: the interactions that dental
// prescribing references (SDCEP; peer-reviewed dental pharmacology reviews)
// single out as the ones a dental note actually produces. Each pattern fires
// only when BOTH agents appear in the note. When the sentence containing the
// second agent already says the combination was avoided, withheld, or
// considered, the finding drops to informational — the clinician did the
// thinking; the record just needs to show it.

interface InteractionPattern {
  id: string;
  a: RegExp;
  b: RegExp;
  aLabel: string;
  bLabel: string;
  severity: Severity;
  why: string;
  how: string;
}

const NSAIDS =
  /\b(?:ibuprofen|advil|motrin|naproxen|aleve|diclofenac|ketorolac|toradol|meloxicam|celecoxib|NSAIDs?)\b/i;
const AZOLES = /\b(?:fluconazole|diflucan|miconazole|ketoconazole|itraconazole)\b/i;
const MACROLIDES = /\b(?:clarithromycin|biaxin|erythromycin)\b/i;
const ANTICOAGULANTS = /\b(?:warfarin|coumadin|jantoven|dabigatran|pradaxa|rivaroxaban|xarelto|apixaban|eliquis)\b/i;
const NONSELECTIVE_BETA_BLOCKERS = /\b(?:propranolol|inderal|nadolol|timolol|sotalol|carvedilol)\b/i;
const STATINS = /\b(?:simvastatin|zocor|atorvastatin|lipitor|lovastatin)\b/i;
const EPINEPHRINE = /\bepinephrine\b|\bepi\b(?=[^a-z]|$)/i;
const SSRIS = /\b(?:fluoxetine|prozac|sertraline|zoloft|paroxetine|paxil|escitalopram|lexapro|citalopram|celexa|SSRIs?)\b/i;
const CORTICOSTEROIDS = /\b(?:prednisone|prednisolone|dexamethasone|methylprednisolone|medrol)\b/i;

const INTERACTIONS: InteractionPattern[] = [
  {
    id: "warfarin-metronidazole",
    a: ANTICOAGULANTS,
    b: /\b(?:metronidazole|flagyl)\b/i,
    aLabel: "an anticoagulant",
    bLabel: "metronidazole",
    severity: "S1",
    why:
      "metronidazole inhibits warfarin metabolism (CYP2C9); dental prescribing references " +
      "document major INR rises and serious bleeding from this pair",
    how:
      "Confirm the prescriber reviewed this combination against the patient's anticoagulation, " +
      "and record the decision and any physician contact in the note."
  },
  {
    id: "warfarin-azole",
    a: ANTICOAGULANTS,
    b: AZOLES,
    aLabel: "an anticoagulant",
    bLabel: "an azole antifungal",
    severity: "S1",
    why:
      "azole antifungals (including topical miconazole, which absorbs systemically) inhibit " +
      "warfarin metabolism; dental references document serious bleeding from this pair",
    how:
      "Confirm the prescriber reviewed this combination and record the decision in the note."
  },
  {
    id: "anticoagulant-nsaid",
    a: ANTICOAGULANTS,
    b: NSAIDS,
    aLabel: "an anticoagulant",
    bLabel: "an NSAID",
    severity: "S1",
    why:
      "NSAIDs on top of an anticoagulant compound bleeding risk; dental prescribing references " +
      "advise against the combination",
    how:
      "Confirm the analgesic choice was made with the anticoagulation in view and record the " +
      "decision in the note."
  },
  {
    id: "warfarin-antibiotic-inr",
    a: ANTICOAGULANTS,
    b: /\b(?:doxycycline|clarithromycin|biaxin|erythromycin)\b/i,
    aLabel: "an anticoagulant",
    bLabel: "an antibiotic with documented INR effect",
    severity: "S2",
    why: "these antibiotics are documented to raise INR in anticoagulated patients",
    how: "Confirm INR monitoring or physician coordination is recorded."
  },
  {
    id: "nsaid-lithium",
    a: NSAIDS,
    b: /\blithium\b/i,
    aLabel: "an NSAID",
    bLabel: "lithium",
    severity: "S1",
    why:
      "NSAIDs inhibit renal excretion of lithium and can push it to toxicity — one of the three " +
      "serious interactions the dental literature says every dentist must know",
    how: "Confirm the analgesic choice was reviewed against the lithium and record the decision."
  },
  {
    id: "nsaid-methotrexate",
    a: NSAIDS,
    b: /\bmethotrexate\b/i,
    aLabel: "an NSAID",
    bLabel: "methotrexate",
    severity: "S1",
    why: "NSAIDs reduce methotrexate clearance; dental prescribing references advise avoidance",
    how: "Confirm the prescriber reviewed the combination and record the decision."
  },
  {
    id: "epinephrine-nonselective-beta-blocker",
    a: EPINEPHRINE,
    b: NONSELECTIVE_BETA_BLOCKERS,
    aLabel: "epinephrine",
    bLabel: "a non-selective beta-blocker",
    severity: "S1",
    why:
      "with non-selective beta-blockade, epinephrine's vasodilating escape is blocked — the " +
      "documented result is a hypertensive reaction with reflex bradycardia",
    how:
      "Confirm the clinician reviewed the combination, and record the exact epinephrine amount " +
      "administered and the blood-pressure response."
  },
  {
    id: "statin-macrolide-or-azole",
    a: STATINS,
    b: new RegExp(`${MACROLIDES.source}|${AZOLES.source}`, "i"),
    aLabel: "a statin",
    bLabel: "a macrolide or azole",
    severity: "S2",
    why: "macrolides and azoles raise statin levels; documented myopathy risk",
    how: "Confirm the prescriber reviewed the combination and record the decision."
  },
  {
    id: "metronidazole-alcohol",
    a: /\b(?:metronidazole|flagyl)\b/i,
    b: /\balcohol\b/i,
    aLabel: "metronidazole",
    bLabel: "alcohol",
    severity: "S2",
    why: "metronidazole with alcohol produces a disulfiram-like reaction",
    how: "Confirm the patient was advised to avoid alcohol and that the advice is recorded."
  },
  {
    id: "nsaid-ssri",
    a: NSAIDS,
    b: SSRIS,
    aLabel: "an NSAID",
    bLabel: "an SSRI",
    severity: "S2",
    why: "SSRIs with NSAIDs raise gastrointestinal bleeding risk",
    how: "Confirm the analgesic choice was reviewed against the SSRI and record the decision."
  },
  {
    id: "nsaid-corticosteroid",
    a: NSAIDS,
    b: CORTICOSTEROIDS,
    aLabel: "an NSAID",
    bLabel: "a systemic corticosteroid",
    severity: "S2",
    why: "the combination raises gastrointestinal ulceration risk",
    how: "Confirm the prescriber reviewed the combination and record the decision."
  },
  {
    id: "nsaid-asthma",
    a: NSAIDS,
    b: /\basthma(?:tic)?\b/i,
    aLabel: "an NSAID",
    bLabel: "a history of asthma",
    severity: "S2",
    why: "NSAIDs are documented to exacerbate asthma in sensitive patients",
    how: "Confirm the history was reviewed before the analgesic choice and record it."
  }
];

// "avoided", "withheld", "not prescribed", "contraindicated — so", "held",
// "instead of": the sentence already shows the clinician did the thinking.
// The cues that mean "the clinician saw this interaction and did not walk into it".
//
// The list originally missed the commonest phrasing of all. A note reading
// "Patient takes apixaban. No NSAIDs advised, acetaminophen only." raised S1 and
// blocked email — on documentation that is not merely adequate but exemplary.
// That is the incentive pointing exactly backwards: the clinician who identifies
// an interaction, avoids it, and writes it down is stopped, while the one who
// never mentions the anticoagulant sails through.
//
// So bare negation of the agent counts ("no NSAIDs", "no ibuprofen"), as do
// "advised against" and "deferred". Found by the precision corpus.
const AVOIDANCE_CUE =
  /\b(?:avoid(?:ed|ing)?|withheld|withhold|no\s+(?:\w+\s+){0,2}(?:nsaids?|ibuprofen|naproxen|aspirin|asa)\b|not\s+(?:prescribed?|given|used|advised|recommended)|advised\s+against|deferred|held|contraindicated|declined|instead\s+of|rather\s+than|only\b|switch(?:ed)?\s+(?:to|from)|allerg)\w*/i;

function sentenceContaining(text: string, index: number): string {
  const start = text.lastIndexOf(".", index);
  const end = text.indexOf(".", index);
  return text.slice(start + 1, end === -1 ? text.length : end + 1);
}

export function runInteractionRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const ix of INTERACTIONS) {
    const aMatch = ix.a.exec(text);
    const bMatch = ix.b.exec(text);
    if (!aMatch || !bMatch) continue;

    const bSentence = sentenceContaining(text, bMatch.index);
    const aSentence = sentenceContaining(text, aMatch.index);
    const avoided = AVOIDANCE_CUE.test(bSentence) || AVOIDANCE_CUE.test(aSentence);

    findings.push({
      ruleId: `medsafe.interaction.${ix.id}`,
      category: "medication-safety",
      severity: avoided ? "S3" : ix.severity,
      message: avoided
        ? `This note mentions both ${ix.aLabel} ("${aMatch[0]}") and ${ix.bLabel} ` +
          `("${bMatch[0]}"), and the wording suggests the combination was considered and ` +
          `avoided. Make sure the record says so explicitly.`
        : `This note records both ${ix.aLabel} ("${aMatch[0]}") and ${ix.bLabel} ` +
          `("${bMatch[0]}"). Why this stops the line: ${ix.why}. This tool does not make ` +
          `prescribing decisions — it requires the record to show that a clinician did.`,
      matchedText: `${aMatch[0]} + ${bMatch[0]}`,
      suggestion: ix.how,
      occurrences: 1
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Controlled-substance prescriptions: the PMP/CSMD gate.
//
// Tennessee requires prescribers to check the Controlled Substance Monitoring
// Database before prescribing opioids (with narrow exceptions). A note that
// records an opioid prescription without recording the database check is a
// note that documents a statutory step as skipped — whether or not it was.
// Flag-only, S1: the fix is one sentence, and the attest path covers the
// statutory exceptions (e.g. certain low-quantity or post-procedure cases),
// which only the prescriber can claim.

const OPIOIDS =
  /\b(?:hydrocodone|vicodin|norco|lortab|oxycodone|percocet|oxycontin|roxicodone|codeine|tylenol\s*(?:#|no\.?\s*)?[34]\b|tramadol|ultram|morphine|hydromorphone|dilaudid|meperidine|demerol)\b/i;

const OPIOID_RX_CUE = /\b(?:prescrib\w+|dispens\w+|rx\b|called\s+in|sent\s+(?:to\s+)?(?:the\s+)?pharmacy)\b/i;

const PMP_CHECKED =
  /\b(?:CSMD|PMP|prescription\s+(?:drug\s+)?monitoring|controlled\s+substance\s+(?:monitoring\s+)?database)\b[^.\n]{0,60}\b(?:checked|reviewed|queried|consulted)\b|\b(?:checked|reviewed|queried|consulted)\b[^.\n]{0,60}\b(?:CSMD|PMP|prescription\s+(?:drug\s+)?monitoring)\b/i;

export function runOpioidPmpRule(text: string): AuditFinding[] {
  const opioid = new RegExp(OPIOIDS.source, OPIOIDS.flags).exec(text);
  if (!opioid) return [];
  if (!new RegExp(OPIOID_RX_CUE.source, OPIOID_RX_CUE.flags).test(text)) return [];
  if (new RegExp(PMP_CHECKED.source, PMP_CHECKED.flags).test(text)) return [];
  return [
    {
      ruleId: "medsafe.opioid-no-pmp-check",
      category: "medication-safety",
      severity: "S1",
      message:
        `An opioid prescription ("${opioid[0]}") is recorded without a documented CSMD/PMP ` +
        `check. Tennessee requires the prescription monitoring database to be checked before ` +
        `prescribing an opioid, and the record must show it happened.`,
      matchedText: opioid[0],
      suggestion:
        'Record the check ("CSMD reviewed prior to prescribing") — or, if a statutory exception ' +
        "applies, attest which one. Only the prescriber can claim an exception.",
      occurrences: 1
    }
  ];
}

export function runMedicationSafetyRules(text: string): AuditFinding[] {
  return [
    ...runWeightUnitRule(text),
    ...runDoseArithmeticRule(text),
    ...runHouseholdUnitRule(text),
    ...runMixedUnitsRule(text),
    ...runInteractionRule(text),
    ...runOpioidPmpRule(text)
  ];
}
