// PUBLIC CHAPTER 1107 (2026) — the supervision rule with a start date.
//
// From January 1, 2027, a dental hygienist must be under DIRECT supervision of
// a dentist who has seen a NEW patient before completing any of: diagnostic
// radiographs, assessment and recording of hard- and soft-tissue data,
// prophylaxis, or fluoride application.
//
// The owner's blueprint says to implement this as an effective-dated validation
// rule NOW rather than leave the date to staff recollection after it arrives,
// and that is the right call: the one thing software is reliably better at than
// people is remembering that a rule changes on a Thursday five months from now.
//
// HOW THE DATE ENTERS WITHOUT BREAKING DETERMINISM. Every other rule in this
// engine is a pure function of the note, and a rule that read the wall clock
// would quietly end that: the same note would audit differently on two days,
// and property tests could never pin it. So the audit date is an INPUT —
// AuditContext.today, defaulting to the real date at the call site — and the
// tests exercise both sides of January 1, 2027 by passing the date in.
//
// BEFORE the effective date, the risky combination raises an S4 advisory, not
// silence: the practice is five months out as this ships, and the cheapest
// time to change a scheduling habit is before the law starts caring. After the
// date it is S1 — it blocks filing, per the blueprint's hard-stop table.

import type { AuditFinding } from "../types";
import type { ModuleDef, NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";

export const EFFECTIVE_DATE = "2027-01-01";

/**
 * Modules whose presence means a listed service is being documented.
 *
 * PC 1107's list maps onto module ids rather than individual fields:
 * diagnostic radiographs (imaging), hard-/soft-tissue data collection
 * (examination, periodontal), prophylaxis and fluoride (preventive).
 */
const LISTED_SERVICE_MODULES = new Set(["imaging", "examination", "periodontal", "preventive"]);

const NEW_PATIENT = "New patient — first visit to this practice";
const GENERAL_SUPERVISION = "General — the dentist authorized in advance";

function selectValue(note: NoteState, moduleId: string, fieldId: string): string | undefined {
  const value = note.values[fieldKey(moduleId, fieldId)];
  return value?.kind === "select" ? value.value : undefined;
}

export function runSupervisionRule(
  note: NoteState,
  modules: ModuleDef[],
  todayIso: string
): AuditFinding[] {
  const hasListedService = modules.some((m) => LISTED_SERVICE_MODULES.has(m.id));
  if (!hasListedService) return [];

  const patientStatus = selectValue(note, "universal-core", "patient-status");
  const supervision = selectValue(note, "universal-core", "supervision");
  const effective = todayIso >= EFFECTIVE_DATE;

  // THE FIELDS ARE ONLY REQUIRED HERE, and only once the law is in force.
  //
  // They are deliberately NOT `required: true` in the schema: a plainly
  // required field puts a REQUIRED finding on every draft already saved, and
  // universal-core.test.ts pins the always-required set for exactly that
  // reason. Patient status and supervision only change anything on a
  // hygiene-service note under PC 1107 — so that is the only place, and the
  // only time, an unanswered value blocks.
  if (!patientStatus || !supervision) {
    if (!effective) return [];
    return [
      {
        ruleId: "supervision.pc1107-unanswered",
        category: "required",
        severity: "S1",
        message:
          "Patient status and Supervision are needed on this note. Public Chapter 1107 (in force " +
          "since January 1, 2027) requires direct supervision for a new patient's diagnostic " +
          "radiographs, tissue-data collection, prophylaxis, or fluoride — and this note documents " +
          "one of those services, so the record has to show both answers.",
        fieldRef: {
          moduleId: "universal-core",
          fieldId: patientStatus ? "supervision" : "patient-status"
        }
      }
    ];
  }

  if (patientStatus !== NEW_PATIENT) return [];
  if (supervision !== GENERAL_SUPERVISION) return [];

  return [
    {
      ruleId: "supervision.pc1107-new-patient",
      category: "required",
      severity: effective ? "S1" : "S4",
      message: effective
        ? "A new patient's diagnostic radiographs, tissue-data collection, prophylaxis, or fluoride " +
          "require direct supervision by a dentist who has seen the patient (Public Chapter 1107, " +
          "effective January 1, 2027). This visit records general supervision. If the dentist was on " +
          "the premises and saw the patient, change Supervision to direct; if not, this note cannot " +
          "be filed as written."
        : "Heads-up, not a block: from January 1, 2027, this combination — new patient, general " +
          "supervision, and hygiene services — will require direct supervision by a dentist who has " +
          "seen the patient (Public Chapter 1107). Nothing is wrong today; the scheduling habit is " +
          "the thing to adjust before the date arrives.",
      fieldRef: { moduleId: "universal-core", fieldId: "supervision" }
    }
  ];
}
