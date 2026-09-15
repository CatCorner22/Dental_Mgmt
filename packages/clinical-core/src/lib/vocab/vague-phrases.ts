// "Replace vague or unsafe phrases" plus the core ambiguity rules —
// mirrors skill/references/terminology-and-style.md.

export interface VaguePhrase {
  id: string;
  pattern: RegExp; // must carry the g flag (scanned with matchAll)
  display: string;
  replacement: string; // "write instead"
}

export const VAGUE_PHRASES: VaguePhrase[] = [
  {
    id: "tolerated-well",
    pattern: /\btolerated\b[^.\n]{0,40}?\bwell\b/gi,
    display: "tolerated well",
    replacement:
      "state the observed response, complications, vital-status facts, and condition at transfer"
  },
  {
    id: "hemostasis-achieved",
    pattern: /\bhemostasis\s+(?:was\s+)?achieved\b/gi,
    display: "hemostasis achieved",
    replacement: "state the method and the observed bleeding status"
  },
  {
    id: "consent-obtained",
    pattern: /\bconsent\s+(?:was\s+)?obtained\b/gi,
    display: "consent obtained",
    replacement: "state the discussion topics, questions, decision, and form status"
  },
  {
    id: "all-questions-answered",
    pattern: /\ball questions\s+(?:were\s+)?answered\b/gi,
    display: "all questions answered",
    replacement: "the clinician answered the patient's stated questions"
  },
  {
    id: "normal",
    pattern: /\bnormal\b(?!\s+saline)/gi,
    display: "normal",
    replacement: "name the structure, test, range, or finding"
  },
  {
    id: "stable",
    pattern: /\bstable\b/gi,
    display: "stable",
    replacement: "name the unchanged finding, the comparison, and the period"
  },
  {
    id: "adequate",
    pattern: /\badequate\b/gi,
    display: "adequate",
    replacement: "state the criterion that was met"
  },
  {
    id: "significant",
    pattern: /\bsignificant\b/gi,
    display: "significant",
    replacement: "state the measurement or clinical effect"
  },
  {
    id: "minimal",
    pattern: /\bminimal\b(?!\s+sedation)/gi,
    display: "minimal",
    replacement: "give a measurement or defined scale; keep formal anesthesia-depth terms"
  },
  {
    id: "moderate",
    // "anxiety" joins "sedation" in the carve-out for the same reason the
    // carve-out exists at all: both are named points on a defined scale rather
    // than a floating adjective. This rule asks a writer to "give a measurement
    // or defined scale", and a three-point self-report question IS the scale —
    // there is no more objective measure of how anxious someone feels. Bare
    // "moderate swelling" still flags, which is the case the rule was written
    // for.
    pattern: /\bmoderate\b(?!\s+(?:sedation|anxiety))/gi,
    display: "moderate",
    replacement:
      "give a measurement or defined scale; formal anesthesia-depth terms and named anxiety scale points are fine"
  },
  {
    // The staff-facing table has listed "minimal, moderate, or large" since the
    // beginning; only two of the three were ever implemented. The reference
    // parity test is what surfaced it — the doc was promising a check the tool
    // did not perform, which is worse than not offering the check at all.
    //
    // No sedation carve-out here, unlike its two siblings: there is no
    // anesthesia depth called "large".
    id: "large",
    pattern: /\blarge\b/gi,
    display: "large",
    replacement: "give a measurement or defined scale"
  },
  {
    id: "routine",
    pattern: /\broutine\b/gi,
    display: "routine",
    replacement: "name the reason, interval, or procedure"
  },
  {
    id: "as-needed",
    pattern: /\bas needed\b/gi,
    display: "as needed",
    replacement: "state the trigger and the action"
  },
  {
    id: "appears",
    pattern: /\bappears\b/gi,
    display: "appears",
    replacement: "state the observation and the reason for uncertainty"
  },
  {
    id: "noncompliant",
    pattern: /\bnon-?compliant\b/gi,
    display: "noncompliant",
    replacement: "state the missed action or declined care and its clinical effect"
  },
  {
    id: "patient-denies",
    pattern: /\b(?:patient|pt)\s+denies\b/gi,
    display: "patient denies",
    replacement: "patient reports no, followed by the exact symptom or event"
  },
  {
    id: "poor-historian",
    pattern: /\bpoor historian\b/gi,
    display: "poor historian",
    replacement: "identify the missing fact and the source limitation"
  },
  {
    id: "unremarkable",
    pattern: /\bunremarkable\b/gi,
    display: "unremarkable",
    replacement: "name the structure and the observed finding"
  },
  {
    id: "grossly-intact",
    pattern: /\bgrossly intact\b/gi,
    display: "grossly intact",
    replacement: "name the tested function and the result"
  },
  {
    id: "no-complications",
    pattern: /\b(?:no complications|without(?:\s+any)?\s+complications)\b/gi,
    display: "no complications",
    replacement:
      "no complication was observed during the stated procedure or observation period"
  },
  {
    id: "no-problems",
    pattern: /\bno problems\b/gi,
    display: "no problems",
    replacement:
      "state what was assessed and the observed result for this encounter — avoid an absolute negative"
  },
  {
    id: "no-issues",
    pattern: /\bno issues\b/gi,
    display: "no issues",
    replacement:
      "state what was assessed and the observed result for this encounter — avoid an absolute negative"
  },
  {
    id: "and-or",
    pattern: /\band\/or\b/gi,
    display: "and/or",
    replacement: "state each option separately; write \"A, B, or both\" when both are possible"
  },
  {
    id: "etc",
    pattern: /\betc\.?(?=[\s,;:)]|$)/gi,
    display: "etc.",
    replacement: "list each item; do not use etc."
  },
  {
    id: "respectively",
    pattern: /\brespectively\b/gi,
    display: "respectively",
    replacement: "repeat the tooth, site, drug, device, or actor instead of pairing lists"
  }
];

// Copy-forward and stale-text signals from the template-residue checks.
// These are review findings: the wording may be true, but a clinician must
// confirm it was written for this visit.
export const STALE_PHRASES: VaguePhrase[] = [
  {
    id: "same-as-above",
    pattern: /\bsame as above\b/gi,
    display: "same as above",
    replacement: "restate the fact for this entry"
  },
  {
    id: "see-previous-note",
    pattern: /\bsee previous note\b/gi,
    display: "see previous note",
    replacement: "state the fact in this entry; link records only in the EDR"
  },
  {
    id: "unchanged",
    pattern: /\bunchanged\b/gi,
    display: "unchanged",
    replacement: "name the unchanged finding, the comparison, and the period"
  },
  {
    id: "today",
    pattern: /\btoday\b/gi,
    display: "today",
    replacement: "use a relative interval or leave the exact date for the EDR"
  },
  {
    id: "last-visit",
    pattern: /\blast visit\b/gi,
    display: "last visit",
    replacement: "state the interval and what happened, or mark it unresolved"
  },
  {
    id: "previously",
    pattern: /\bpreviously\b/gi,
    display: "previously",
    replacement: "state when and what happened, or mark it unresolved"
  }
];

// ---------------------------------------------------------------------------
// Stigmatizing and judgemental language — the 21st Century Cures Act list
// ---------------------------------------------------------------------------
//
// The Cures Act information-blocking rules give patients routine, immediate
// access to these notes. The audience changed; the vocabulary mostly did not.
// A word that reads as clinical shorthand to the person who typed it can read
// as a verdict to the person it is about, and a patient who feels judged by
// their record is less likely to report the next symptom honestly.
//
// This is a SEPARATE list from VAGUE_PHRASES on purpose. Those entries are
// about a fact being missing. These are about a person being labelled, and the
// note may be perfectly specific and still fail here. Different defect,
// different category, different guidance.
//
// STYLE severity, and never auto-applied. Every one of these is a judgement
// call in context — "declined" is usually right for "refused", but not if the
// clinical point is that care was actively resisted — and this tool does not
// rewrite clinical meaning. It says what it noticed and leaves the wording to
// the clinician.
//
// Deliberately NOT duplicated here: `noncompliant`, `patient denies`, and
// `poor historian`, which are already in VAGUE_PHRASES at REVIEW severity.
// Listing them twice would flag the same span twice and downgrade nothing —
// it would just teach people that the findings panel repeats itself, which is
// how a checker starts getting ignored.
//
// Patterns are anchored to the LABELLING usage rather than the word alone.
// "Diabetic retinopathy" is a diagnosis; "the diabetic in chair two" is a
// label. A rule that cannot tell them apart cries wolf, and a checker that
// cries wolf gets muted — which costs more than the rule ever gains.
export const STIGMATIZING_PHRASES: VaguePhrase[] = [
  {
    id: "person-first-diabetic",
    // "diabetic patient" / "is a diabetic" / "the diabetics" — never the
    // adjectival diagnosis ("diabetic ketoacidosis", "diabetic neuropathy").
    pattern: /\bdiabetic\s+(?:patient|pt)s?\b|\bis\s+an?\s+diabetic\b|\b(?:a|the)\s+diabetics\b/gi,
    display: "diabetic (as a label)",
    replacement: "person with diabetes — keep \"diabetic\" for the diagnosis itself"
  },
  {
    id: "person-first-epileptic",
    pattern: /\bepileptic\s+(?:patient|pt)s?\b|\bis\s+an?\s+epileptic\b|\b(?:a|the)\s+epileptics\b/gi,
    display: "epileptic (as a label)",
    replacement: "person with epilepsy — keep \"epileptic\" for the seizure type"
  },
  {
    id: "person-first-addict",
    pattern: /\b(?:drug\s+)?(?:addicts?|abusers?|junkies?)\b/gi,
    display: "addict / abuser",
    replacement: "person with a substance use disorder, or state the substance and the history"
  },
  {
    id: "drug-seeking",
    pattern: /\bdrug[-\s]seek(?:ing|er)s?\b/gi,
    display: "drug seeking",
    replacement: "state what was requested, what was discussed, and what was prescribed or declined"
  },
  {
    id: "patient-refused",
    // Anchored to the patient so the module named "Refusal and Incomplete
    // Care" and the field "Consent or refusal form status" are untouched:
    // those name a category, they do not describe a person.
    //
    // "tx" is in the object list because the standardizer expands tx ->
    // treatment. Without it, "Refused tx." was clean, the clinician pressed
    // Standardize, and the tool flagged the wording it had just written itself
    // - advice about words the user never typed. Flagging the shorthand form
    // too makes the finding identical before and after the round trip. The
    // same self-referential loop the abbreviation rule already fixed once with
    // definedInText.
    pattern:
      /\b(?:patient|pt)\s+refus(?:ed|es)\b|\brefus(?:ed|es)\s+(?:treatment|tx|care|the\s+(?:procedure|radiograph|referral|appointment))\b/gi,
    display: "patient refused",
    replacement: "declined — and state what was declined and what was discussed"
  },
  {
    id: "patient-failed",
    pattern: /\b(?:patient|pt)\s+failed\s+to\b/gi,
    display: "patient failed to",
    replacement: "did not — state what did not happen without attributing fault"
  },
  {
    id: "patient-claims",
    pattern: /\b(?:patient|pt)\s+(?:claims?|alleges?|insists?)\b/gi,
    display: "patient claims",
    replacement: "patient reports — \"claims\" tells the reader you doubt them"
  },
  {
    id: "uncooperative",
    pattern: /\buncooperative\b|\bcombative\b/gi,
    display: "uncooperative",
    replacement: "describe the behaviour observed and what was tried"
  },
  {
    id: "frequent-flyer",
    pattern: /\bfrequent\s+flyer\b/gi,
    display: "frequent flyer",
    replacement: "state the visit history and the reason for each attendance"
  },
  {
    id: "no-show",
    pattern: /\bno[-\s]shows?\b/gi,
    display: "no-show",
    replacement: "did not attend"
  }
];
