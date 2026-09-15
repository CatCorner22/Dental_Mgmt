import type { FieldOption, ToothPickerField } from "@/lib/schema/types";

export function opts(...values: string[]): FieldOption[] {
  return values.map((value) => ({ value }));
}

// An OPTIONAL, validated tooth field for procedural modules whose site is a
// natural tooth some of the time but not always (a crown is on a tooth; a
// biopsy usually is not). Keeping it optional means a clinician is never forced
// to invent a tooth number for soft-tissue or edentulous work — but when the
// site IS a tooth, it is captured through the validated picker instead of free
// text, which is what puts it under the wrong-site poka-yoke (invalid-tooth and
// surface-orphan are S0 in runAnatomyStateRule). The existing free-text site
// field stays alongside it for the nuance a picker cannot hold: pontic spans,
// edentulous sites, abutment vs. natural-tooth distinctions, lesion regions.
export function optionalTeeth(id: string, label: string, helpText?: string): ToothPickerField {
  return {
    id,
    type: "toothPicker",
    label,
    required: false,
    dentitions: ["permanent", "primary", "supernumerary-permanent", "supernumerary-primary"],
    multiple: true,
    ...(helpText ? { helpText } : {})
  };
}

export const YES_NO = opts("yes", "no");

// Data states from the controlled terminology. A blank never means normal.
export const DATA_STATES = opts(
  "present",
  "absent",
  "not assessed",
  "not applicable",
  "unknown",
  "unresolved"
);

// Procedure states — do not collapse these.
export const PROCEDURE_STATES = opts(
  "recommended",
  "planned",
  "authorized",
  "consented",
  "started",
  "completed",
  "partly completed",
  "stopped",
  "deferred",
  "declined"
);

export const CARE_STATUS = opts(
  "started",
  "completed",
  "partly completed",
  "stopped",
  "deferred"
);

export const PATIENT_DECISION = opts(
  "accepted",
  "declined",
  "deferred",
  "requested another option"
);

export const EDR_ONLY_STATUS = opts(
  "recorded in the EDR",
  "pending in the EDR",
  "not applicable"
);

// Evidence-source stems for free-text phrase chips.
export const EVIDENCE_PHRASES = [
  "The clinician observed ",
  "The patient reports ",
  "The parent or guardian reports ",
  "The external record states ",
  "The test result shows ",
  "The image interpretation states ",
  "Not assessed.",
  "Not applicable.",
  "Unknown.",
  "Unresolved."
];

export const NONE_REPORTED = "None reported.";

// ---------------------------------------------------------------------------
// Safety block: the fields where "nothing to report" is the dangerous answer.
//
// A blank allergy box means "we do not know". "No known drug allergies" means
// somebody asked and the answer was none — an affirmative clinical claim, and
// the one a later reader leans on before prescribing. The two are not the same
// fact, and a form that lets the second happen by default is a form that
// manufactures it.
//
// So each of these carries an explicit status (never a bare yes/no "reviewed"
// tick) and, when the status is a negative, a separate confirmation saying
// whether it was asked TODAY or carried forward. Tennessee requires a concise
// medical history sufficient for a later dentist to continue care; carried
// forward and asked-today are different levels of evidence for that, and only
// the person in the room knows which one applies.

/** The literal stored for each negative status — referenced by visibleIf. */
export const NKA = "No known allergies of any kind (NKA).";
export const NKDA = "No known drug allergies (NKDA); other allergy types not excluded.";
export const NO_MEDICATIONS = "No current medications reported.";
export const NO_HISTORY_CHANGES = "No changes reported to the medical history.";
export const PREMED_NOT_REQUIRED = "Not required.";

export const ALLERGY_STATUS: FieldOption[] = [
  { value: NKA, label: "No known allergies of any kind (NKA)" },
  { value: NKDA, label: "No known drug allergies (NKDA) — other types not excluded" },
  {
    value: "Allergies on file; see the allergy list in the clinical system.",
    label: "Allergies on file (details stay in the EDR)"
  },
  {
    value: "Allergy history not reviewed at this visit.",
    label: "Not reviewed at this visit"
  }
];

export const MEDICATION_STATUS: FieldOption[] = [
  { value: NO_MEDICATIONS, label: "None reported" },
  {
    value: "Medication list reviewed; see the medication list in the clinical system.",
    label: "List reviewed (details stay in the EDR)"
  },
  {
    value: "Medication list not reviewed at this visit.",
    label: "Not reviewed at this visit"
  }
];

export const NEGATIVE_STATUS_HISTORY: FieldOption[] = [
  { value: NO_HISTORY_CHANGES, label: "No changes reported" },
  { value: "Changes reported; see below.", label: "Changes reported" },
  { value: "Medical history not reviewed at this visit.", label: "Not reviewed at this visit" }
];

export const PREMEDICATION_STATUS: FieldOption[] = [
  { value: PREMED_NOT_REQUIRED, label: "Not required" },
  { value: "Required; taken before the appointment as directed.", label: "Required — taken" },
  {
    // Deliberately blunt. This is a stop-and-ask, not a note written afterwards.
    value: "Required; NOT taken. Dentist notified before treatment.",
    label: "Required — not taken (tell the dentist now)"
  },
  {
    value: "Premedication requirement not reviewed at this visit.",
    label: "Not reviewed at this visit"
  }
];

// ---------------------------------------------------------------------------
// How the encounter happened, and how fast it needed to happen.
//
// The practice contacts patients by phone and by portal message far more often
// than it sees them, and until now every one of those had to be filed as one of
// nine in-office visit types or as a teledentistry encounter. Teledentistry is
// the wrong answer and a regulated one: Tennessee Rule 0460-01-.19 counts an
// encounter as teledentistry only when secure video or store-and-forward
// technology carried it, and says in terms that audio-only, email alone, and
// fax alone do not qualify. A phone call filed as teledentistry is a false
// statement about a regulated category, made by the form rather than the writer.

export const CONTACT_METHOD: FieldOption[] = [
  { value: "in person at the office", label: "In person at the office" },
  { value: "telephone", label: "Telephone" },
  { value: "secure video", label: "Secure video" },
  { value: "secure patient-portal message", label: "Secure patient-portal message" },
  { value: "written letter", label: "Written letter" },
  {
    value: "another office or clinician contacted this office",
    label: "Another office or clinician contacted this office"
  }
];

// "routine" is itself on the vague-phrase list — the audit asks a writer to
// name the reason, interval, or procedure instead. An option value the app's
// own audit flags is the app disagreeing with itself, so the low end of this
// scale says what it means: the encounter was scheduled and nobody reported
// urgency.
export const URGENCY: FieldOption[] = [
  { value: "scheduled; no urgency reported", label: "Scheduled — no urgency reported" },
  { value: "urgent; same-day care needed", label: "Urgent — same-day care needed" },
  { value: "emergency; immediate care needed", label: "Emergency — immediate care needed" }
];

// ---------------------------------------------------------------------------
// Open items: what the office still owes after the patient leaves.
//
// The whole block hangs off one gate, so a note with nothing open composes
// exactly as it did before and no existing draft gains a required field.
//
// Owner is a SELECT of roles and due is a SELECT of relative intervals, and
// both are selects on purpose. A free-text owner collects staff names; a
// free-text due date collects "8/14" — an exact date, which the privacy rule
// stops at S0. Making the safe answer the only answer beats catching the unsafe
// one afterwards.

export const NOTHING_OPEN = "Nothing is open. This encounter needs no follow-up action.";
export const ITEM_OPEN = "An item is open.";

export const OPEN_ITEM_STATUS: FieldOption[] = [
  { value: NOTHING_OPEN, label: "Nothing is open" },
  { value: ITEM_OPEN, label: "An item is open — record it below" }
];

export const OPEN_ITEM_OWNER: FieldOption[] = [
  { value: "the treating dentist", label: "The treating dentist" },
  { value: "a hygienist", label: "A hygienist" },
  { value: "a dental assistant", label: "A dental assistant" },
  { value: "the treatment coordinator", label: "The treatment coordinator" },
  { value: "the front-desk coordinator", label: "The front-desk coordinator" },
  { value: "the office manager", label: "The office manager" },
  { value: "the referring or specialist office", label: "The referring or specialist office" },
  { value: "the patient", label: "The patient" }
];

// Relative only. "today" is on the stale-text list and an exact date is an
// identifier, so neither can appear here.
export const OPEN_ITEM_DUE: FieldOption[] = [
  {
    value: "before the patient leaves this appointment",
    label: "Before the patient leaves this appointment"
  },
  { value: "same day", label: "Same day" },
  { value: "within 1 business day", label: "Within 1 business day" },
  { value: "within 3 business days", label: "Within 3 business days" },
  { value: "within 1 week", label: "Within 1 week" },
  { value: "within 2 weeks", label: "Within 2 weeks" },
  { value: "within 1 month", label: "Within 1 month" },
  { value: "at the next scheduled visit", label: "At the next scheduled visit" }
];

export const OPEN_ITEM_TRACKING: FieldOption[] = [
  {
    value: "created as a task in the clinical system",
    label: "Created as a task in the clinical system"
  },
  {
    value: "added to the office's shared follow-up list",
    label: "Added to the office's shared follow-up list"
  },
  {
    value: "handed to the responsible role in person and acknowledged",
    label: "Handed to the responsible role in person and acknowledged"
  },
  // The honest option. Without it, everyone picks a tracking system that does
  // not hold the item, and the note says the office is on top of something it
  // has not written down anywhere.
  { value: "not yet tracked anywhere", label: "Not yet tracked anywhere" }
];

// How the patient-facing summary actually reached the patient. A summary
// written and never handed over is a draft, and the difference matters to the
// person who has to answer "were they told?".
export const PATIENT_SUMMARY_DELIVERY: FieldOption[] = [
  {
    value: "read aloud to the patient, and a printed copy given",
    label: "Read aloud and a printed copy given"
  },
  { value: "read aloud to the patient", label: "Read aloud to the patient" },
  { value: "a printed copy given to the patient", label: "Printed copy given" },
  { value: "sent through the patient portal", label: "Sent through the patient portal" },
  {
    value: "read aloud to the parent or guardian",
    label: "Read aloud to the parent or guardian"
  },
  { value: "not yet given to the patient", label: "Not yet given to the patient" }
];

// The double-check itself. Deliberately not a yes/no tick: the useful
// distinction is not "did you confirm" (everyone ticks yes) but WHAT the
// confirmation rests on, and carrying a negative forward unasked is the
// specific failure that puts a stale "no allergies" in front of a prescriber.
export const CONFIRM_ASKED: FieldOption[] = [
  {
    value: "Confirmed with the patient at this visit and checked against the chart.",
    label: "Asked the patient at this visit and checked the chart"
  },
  {
    value: "Confirmed with the patient at this visit.",
    label: "Asked the patient at this visit"
  },
  {
    value: "Carried forward from the chart; not re-confirmed with the patient at this visit.",
    label: "Carried forward from the chart — not re-asked at this visit"
  }
];
