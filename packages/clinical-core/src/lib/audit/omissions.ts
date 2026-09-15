// NAMED OMISSION LICENCES: making the escape hatch countable instead of invisible.
//
// A usability review of this app found the same weakness from two directions, and
// it is the most important adoption-versus-integrity problem the tool has.
//
// The required rule tells a writer: "Enter the fact, or state not assessed, not
// applicable, unknown, or unresolved." That escape is CORRECT and must stay. The
// GOV.UK service manual is explicit that where not-knowing is a valid answer it has
// to be a first-class one, because a form that refuses to accept "I do not know" is
// a form that gets a fabricated value instead — and a fabricated value in a
// clinical record is far worse than a recorded absence.
//
// But it is also, measurably, the path of least resistance. Clicking "not
// applicable" is one action; finding out the actual answer is a conversation with a
// patient or a look through a chart. A reviewer walking the app cold identified
// exactly this: the fastest way to clear a required field is to say it does not
// apply, and nothing anywhere notices.
//
// THE FIX IS NOT TO CLOSE THE ESCAPE. It is the emergency-dispatch pattern: in the
// Medical Priority Dispatch System, a dispatcher may skip a protocol question under
// a short list of ENUMERATED conditions — the answer is already obvious, the caller
// volunteered it, the caller is in danger. The shortcut lives INSIDE the protocol
// rather than being a deviation from it, which makes it finite, named, and
// countable. A deviation you cannot count is a deviation you cannot manage.
//
// So: the licences are named, the note carries how many it used, the writer is told
// before filing, and a Team Lead can see the rate. Nothing is blocked. Nothing is
// forbidden. It stops being invisible, which is the only thing that was wrong.
//
// See knowledge/sources/high-stakes-documentation-patterns.md.

import type { ModuleDef, NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldRequired, isFieldVisible } from "@/lib/schema/conditions";

export interface OmissionLicence {
  id: string;
  /** What the writer chose, as the audit and the vocabulary phrase it. */
  label: string;
  /** Matches the value as staff actually write it. */
  pattern: RegExp;
  /**
   * What it asserts, said precisely — because these are NOT interchangeable and a
   * reader months later needs to know which one was meant.
   */
  means: string;
}

/**
 * The finite set. Adding one is a deliberate act, which is the point.
 *
 * Ordered from strongest to weakest claim: "not applicable" says the question does
 * not arise, "not assessed" says nobody looked, "unknown" says someone looked and
 * could not find out, "unresolved" says it is open and being carried. They answer
 * different questions and a later reader who cannot tell them apart has learned
 * nothing from any of them.
 */
export const OMISSION_LICENCES: readonly OmissionLicence[] = [
  {
    id: "not-applicable",
    label: "not applicable",
    pattern: /\b(?:not applicable|n\/a)\b/i,
    means: "The question does not arise for this visit."
  },
  {
    id: "not-assessed",
    label: "not assessed",
    pattern: /\bnot (?:assessed|examined|evaluated|performed|done)\b/i,
    means: "Nobody looked at this during this visit."
  },
  {
    id: "not-reviewed",
    label: "not reviewed at this visit",
    pattern: /\bnot reviewed(?: at this visit)?\b/i,
    means: "This was not gone through with the patient today."
  },
  {
    id: "unknown",
    label: "unknown",
    pattern: /\b(?:unknown|could not (?:be )?determin\w*|unable to determine)\b/i,
    means: "Someone tried to find out and could not."
  },
  {
    id: "unresolved",
    label: "unresolved",
    pattern: /\b(?:unresolved|pending|awaiting)\b/i,
    means: "Still open, and carried forward deliberately."
  }
];

/**
 * The licence as it should be WRITTEN into a clinical field.
 *
 * A record entry is a sentence. "not applicable" is a UI label; "Not applicable."
 * is what a later reader should find in the note, and matching the shape of a
 * typed answer keeps a one-click licence indistinguishable from a deliberate one —
 * which it is.
 */
export function licenceText(licence: OmissionLicence): string {
  return `${licence.label[0].toUpperCase()}${licence.label.slice(1)}.`;
}

/**
 * Is this field's whole value nothing but a licence?
 *
 * DELIBERATELY STRICTER THAN `licenceFor`, and the difference is a safety
 * property rather than a nicety. `licenceFor` asks "does this text invoke a
 * licence anywhere in it", which is the right question for counting. This asks
 * "is this text ONLY a licence", which is the only safe basis for a control that
 * OVERWRITES the field: "Radiograph not reviewed at this visit because the sensor
 * failed" invokes a licence and is also a real clinical sentence, and a chip that
 * replaced it with the bare licence would silently delete the writer's account of
 * what happened.
 *
 * So the chips appear on an empty field or on one holding exactly a licence, and
 * on nothing else. Prose is never one click from gone.
 */
export function exactLicence(text: string): OmissionLicence | null {
  const normalized = text.trim().replace(/\.+$/, "").toLowerCase();
  if (!normalized) return null;
  return OMISSION_LICENCES.find((l) => l.label.toLowerCase() === normalized) ?? null;
}

export interface OmissionCount {
  licence: OmissionLicence;
  /** Field labels that used it, so the writer can see WHERE rather than only how many. */
  fields: string[];
}

export interface OmissionReport {
  /** Required, visible fields that carry a real answer. */
  answered: number;
  /** Required, visible fields satisfied by a licence rather than a fact. */
  licensed: number;
  /** Per-licence breakdown, most used first, empty entries dropped. */
  byLicence: OmissionCount[];
  /**
   * Licensed as a share of every required field that was answered at all.
   *
   * Empty fields are excluded from BOTH sides: an unfilled required field is
   * already an S1 finding that blocks filing, and counting it here would make the
   * rate say something about incompleteness rather than about substitution.
   */
  rate: number;
}

/** Which licence, if any, does this text invoke? */
export function licenceFor(text: string): OmissionLicence | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const licence of OMISSION_LICENCES) {
    licence.pattern.lastIndex = 0;
    if (licence.pattern.test(trimmed)) return licence;
  }
  return null;
}

/**
 * How much of this note's required content is a recorded absence.
 *
 * Walks only REQUIRED, VISIBLE fields, because those are the ones the tool insisted
 * on — a licence in an optional field is a writer being helpfully explicit, not a
 * shortcut, and counting it would bury the signal in noise.
 */
export function omissionReport(note: NoteState, modules: ModuleDef[]): OmissionReport {
  const byId = new Map<string, OmissionCount>();
  let answered = 0;
  let licensed = 0;

  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (!isFieldVisible(field, mod.id, note)) continue;
        if (!isFieldRequired(field, mod.id, note)) continue;
        const value = note.values[fieldKey(mod.id, field.id)];
        if (!value) continue;

        // Only text-shaped answers can carry a licence. A tooth picker or a
        // measurement either has a value or does not.
        let text = "";
        if (value.kind === "text") text = value.value;
        else if (value.kind === "select") text = `${value.value} ${value.otherText ?? ""}`;
        else if (value.kind === "multiselect") text = value.values.join(" ");
        if (!text.trim()) continue;

        const licence = licenceFor(text);
        if (!licence) {
          answered++;
          continue;
        }
        licensed++;
        const entry = byId.get(licence.id) ?? { licence, fields: [] };
        entry.fields.push(field.label);
        byId.set(licence.id, entry);
      }
    }
  }

  const total = answered + licensed;
  return {
    answered,
    licensed,
    byLicence: [...byId.values()].sort(
      (a, b) => b.fields.length - a.fields.length || a.licence.id.localeCompare(b.licence.id)
    ),
    rate: total === 0 ? 0 : Math.round((licensed / total) * 100) / 100
  };
}

/**
 * The share above which a note is worth a second look before filing.
 *
 * NOT a gate, and it must never become one. A genuinely simple visit legitimately
 * carries several "not applicable" answers, and a threshold that blocked filing
 * would teach staff to type a plausible-sounding fact instead — which is the exact
 * harm the escape hatch exists to prevent. It changes what the writer is TOLD, and
 * nothing else.
 */
export const OMISSION_NOTICE_THRESHOLD = 0.5;
