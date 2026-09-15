import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import type { ModuleDef, NoteState } from "@/lib/schema/types";

// Severity model from the formal audit pass in
// skill/assets/dental-note-templates.md. The audit never returns a
// percentage or claims a note is complete or compliant.

export type Severity = "S0" | "S1" | "S2" | "S3" | "S4";

/**
 * The severity word, in sentence case.
 *
 * These were "STOP" / "REQUIRED" / "REVIEW" / "STYLE" / "INFO" and are now
 * "Stop" / "Required" / "Review" / "Style" / "Info". The vocabulary did not
 * change — only the shouting did. All-caps text is read letter by letter
 * rather than by word shape, so it is measurably SLOWER to read than the
 * sentence case it replaces, and it does not make a label conspicuous; weight,
 * colour and position do that. A findings list where every row opens with a
 * shouted word reads as an argument rather than a checklist.
 *
 * See src/lib/theme/casing.ts, which holds the rule and the test that keeps it.
 */
export const SEVERITY_LABELS: Record<Severity, string> = {
  S0: "Stop",
  S1: "Required",
  S2: "Review",
  S3: "Style",
  S4: "Info"
};

/**
 * Non-color channel for CVD / glove glance — shape travels with the word.
 * Hue alone collapses S0/S1/S2 under deuteranopia (Honest Finish hate panels).
 */
export const SEVERITY_SHAPE: Record<Severity, string> = {
  S0: "■",
  S1: "▲",
  S2: "◆",
  S3: "●",
  S4: "○"
};

/**
 * What a severity means, in a sentence, for the person reading it.
 *
 * The labels above are the practice's formal audit vocabulary and they stay. These
 * are for the screen. A usability review of the builder found the panel rendering
 * "S1 REQUIRED" — the internal code AND the label — and a non-clinical reviewer read
 * it as an error code they had done something to deserve. The code is taxonomy for
 * the ruleset and the frozen report; it is not an instruction to a human.
 *
 * Each one says what happens next, because that is the only question the reader has.
 */
export const SEVERITY_MEANING: Record<Severity, string> = {
  S0: "Must be fixed. This blocks copying and filing.",
  S1: "Needed before this note can be filed.",
  S2: "Open review. Does not block Copy. Does not mean finished.",
  S3: "Wording only. Does not block.",
  S4: "For information. Does not block."
};

export const SEVERITY_ORDER: Severity[] = ["S0", "S1", "S2", "S3", "S4"];

export type AuditCategory =
  | "phi"
  | "required"
  | "template-residue"
  | "stale-text"
  | "duplicate-text"
  | "anatomy"
  | "abbreviation"
  | "vague-phrase"
  | "stigmatizing"
  | "plain-language"
  | "spelling"
  | "measurement"
  | "medication-safety";

export interface AuditFinding {
  ruleId: string;
  category: AuditCategory;
  severity: Severity;
  message: string;
  fieldRef?: { moduleId: string; fieldId: string };
  matchedText?: string;
  suggestion?: string; // shown to the user; never auto-applied
  occurrences?: number;
}

export type OverallStatus =
  | "BLOCKED"
  | "NEEDS CLINICIAN ACTION"
  | "READY FOR CLINICIAN REVIEW"
  | "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED";

export interface AuditReport {
  findings: AuditFinding[]; // sorted S0 -> S4
  counts: Record<Severity, number>;
  status: OverallStatus;
  phiStops: AuditFinding[]; // category phi at S0
}

export interface AuditGates {
  // Copy and download: blocked by ANY S0 stop (jidoka — a defective note does
  // not leave the tool). A PHI stop is the one kind a person can waive, via
  // the explicit override dialog.
  exportAllowed: boolean;
  // Email: everything export requires, plus zero S1.
  emailAllowed: boolean;
}

export interface AuditContext {
  note: NoteState;
  modules: ModuleDef[]; // active modules
  composedText: string;
  /**
   * The date the audit is being run, as ISO yyyy-mm-dd. Defaults to the real
   * date at the call site.
   *
   * An INPUT rather than a clock read, because one rule (supervision.pc1107)
   * changes behaviour on an effective date, and a rule that read the wall
   * clock inside the engine would make the same note audit differently on two
   * days with nothing in the inputs to show why. Passing the date keeps every
   * audit a pure function of its arguments, which is what lets tests pin both
   * sides of the boundary.
   */
  today?: string;
  /**
   * Writer's clinical role. When set, dentist-judgement coaching is tailored
   * away for auxiliaries who cannot author Assessment/Plan (see
   * tailorForAuthor.ts). Omit for text-only audits and frozen historical runs.
   */
  clinicalRole?: ClinicalRole;
}

// One severity ramp, used by every surface that renders a finding.
//
// This existed twice — `SEVERITY_STYLES` in AuditPanel.tsx and `SEV_CLASS` in
// Standardizer.tsx — and the two had drifted apart at S3 and S4. The SAME
// finding rendered blue in the note builder and grey on the Standardize page,
// which quietly told a clinician that an informational item was a different
// KIND of item depending on which screen they happened to be looking at.
// Severity is the app's core safety vocabulary; it cannot mean two things.
export const SEVERITY_CLASS: Record<Severity, string> = {
  S0: "border-severity-stop/30 bg-severity-stop-soft text-severity-stop-ink",
  S1: "border-severity-required/30 bg-severity-required-soft text-severity-required-ink",
  S2: "border-severity-review/40 bg-severity-review-soft text-severity-review-ink",
  S3: "border-severity-style/30 bg-severity-style-soft text-severity-style-ink",
  S4: "border-severity-info/30 bg-severity-info-soft text-severity-info-ink"
};

/**
 * The severity as a LEFT RAIL rather than a full tinted box.
 *
 * A design review called the findings list "a wall of red shouting" and it was
 * right: every finding was a filled, bordered, tinted box stacked hard against the
 * next one, so eleven open required fields read as eleven alarms rather than as a
 * checklist of eleven things to type. A rail carries the same severity information
 * at a fraction of the visual weight, which is what lets a list of them be scanned
 * instead of endured.
 *
 * Same colours as above, deliberately — the palette is the audit vocabulary and it
 * does not get re-derived for a second presentation.
 */
export const SEVERITY_RAIL: Record<Severity, string> = {
  S0: "border-l-severity-stop-rail bg-severity-stop-soft/60",
  S1: "border-l-severity-required-rail bg-severity-required-soft/60",
  S2: "border-l-severity-review-rail bg-severity-review-soft/60",
  S3: "border-l-severity-style-rail bg-severity-style-soft/50",
  S4: "border-l-severity-info-rail bg-severity-info-soft/60"
};

/**
 * The severity as INK ALONE, for a finding printed under the field it is about.
 *
 * There is no room for a rail or a chip in the two lines beneath a text box, and
 * the previous answer to that was `text-rose-700` hardcoded for all five — so a
 * note whose only remark was an S4 "consider naming the shade" was rendered in
 * precisely the same red as a note that could not legally be filed. Colour is
 * the fastest thing on the screen to read and it was saying the wrong word.
 *
 * Ink tokens match the shared severity ramp; contrast is asserted in
 * contrast.test.ts against white.
 */
export const SEVERITY_TEXT: Record<Severity, string> = {
  S0: "text-severity-stop-ink",
  S1: "text-severity-required-ink",
  S2: "text-severity-review-ink",
  S3: "text-severity-style-ink",
  S4: "text-severity-info-ink"
};

/** The severity word as a small chip. Glanceable, not a headline. */
export const SEVERITY_CHIP: Record<Severity, string> = {
  S0: "bg-severity-stop text-severity-stop-on",
  S1: "bg-severity-required text-severity-required-on",
  S2: "bg-severity-review text-severity-review-on",
  S3: "bg-severity-style text-severity-style-on",
  S4: "bg-severity-info text-severity-info-on"
};

// The overall-status banner, keyed on OverallStatus so a renamed status is a
// type error rather than an unstyled banner.
export const STATUS_CLASS: Record<OverallStatus, string> = {
  BLOCKED: "border-severity-stop/40 bg-severity-stop-soft text-severity-stop-ink",
  "NEEDS CLINICIAN ACTION":
    "border-severity-required/40 bg-severity-required-soft text-severity-required-ink",
  "READY FOR CLINICIAN REVIEW":
    "border-severity-review/40 bg-severity-review-soft text-severity-review-ink",
  "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED":
    "border-severity-clear/40 bg-severity-clear-soft text-severity-clear-ink"
};

/**
 * The overall status as a person should read it.
 *
 * `OverallStatus` itself stays shouted, and that is deliberate: it is a STORED
 * value, not a label. It is frozen into `submissions.auditStatus` at filing,
 * counted by name in computeStats, and keyed by name in STATUS_CLASS above.
 * Renaming the union would rewrite the meaning of every note already filed —
 * a note's audit status at the moment it was filed is a compliance fact, and
 * facts about the past do not get restyled.
 *
 * So the enum is the record and this is the presentation. Every screen renders
 * through `statusLabel`; nothing renders the raw union.
 */
export const STATUS_DISPLAY: Record<OverallStatus, string> = {
  BLOCKED: "Blocked",
  "NEEDS CLINICIAN ACTION": "Needs clinician action",
  // Honest Finish: never lead with "Ready" while review items remain.
  "READY FOR CLINICIAN REVIEW": "Needs clinician review",
  "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED": "Audit clear — clinician review still required"
};

/**
 * Present a stored audit status.
 *
 * Takes a plain string rather than an `OverallStatus` because the callers that
 * need it most are reading history: `submissions.auditStatus` is text written
 * by whichever ruleset was current at filing time, and a status this build has
 * never heard of is a real possibility on an old row. An unknown value comes
 * back verbatim — showing what was actually recorded beats showing nothing, and
 * a filed note's status is not something to guess at.
 */
export function statusLabel(stored: string): string {
  return STATUS_DISPLAY[stored as OverallStatus] ?? stored;
}

/**
 * Present a severity that arrived as a plain string.
 *
 * Same reason as `statusLabel`: some callers hold a severity that was widened
 * to `string` on its way through a scenario fixture or a stored row. Falling
 * back to the raw code keeps an unknown severity visible rather than blank.
 */
export function severityLabel(stored: string): string {
  return SEVERITY_LABELS[stored as Severity] ?? stored;
}
