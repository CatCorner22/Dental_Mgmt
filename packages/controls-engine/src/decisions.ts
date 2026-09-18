/**
 * The control decision register: the owner's dated, attributed answer to a
 * finding. Findings are detected by the engine; decisions are made by a
 * person and never expire silently — an overdue review is itself a finding.
 *
 * Pure functions over decision rows. Persistence lives in the app.
 */
import type { DetectedConflict } from "./sod/detect";
import { controlIdForRule } from "./templates";

export const DECISION_KINDS = [
  "remediate",
  "compensate",
  "accept_residual",
  "monitor",
  "insure",
  /**
   * The decision it supersedes no longer stands and nothing replaces it
   * (Increment 1.27). A retired subject reads as undecided again. Only
   * written by a review; never offered as a first decision.
   */
  "retire",
] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

/** The kinds an owner may choose when first deciding; retire comes only from a review. */
export const FIRST_DECISION_KINDS = DECISION_KINDS.filter((k) => k !== "retire") as Exclude<DecisionKind, "retire">[];

export const DECISION_SUBJECT_KINDS = [
  "sod_finding",
  "grant",
  "control",
  "exception",
  "scenario",
  "knowledge",
  /** A detector's control_findings row (Increment 1.26); the subject id is the finding id. */
  "detector_finding",
  /**
   * One of the practice's reason codes (Increment 1.47); the subject id is the
   * code itself, which never changes, so the decision keeps pointing at the same
   * reason for as long as the practice holds it.
   */
  "reason_code",
] as const;
export type DecisionSubjectKind = (typeof DECISION_SUBJECT_KINDS)[number];

export const DECISION_KIND_LABEL: Record<DecisionKind, string> = {
  remediate: "Remediate",
  compensate: "Compensate",
  accept_residual: "Accept residual",
  monitor: "Monitor",
  insure: "Transfer / insure",
  retire: "Retired",
};

export interface ControlDecision {
  id: string;
  subjectKind: DecisionSubjectKind;
  subjectId: string;
  kind: DecisionKind;
  note: string;
  /** ISO date YYYY-MM-DD; the day the decision must be looked at again. */
  reviewBy?: string;
  residualAtDecision?: number;
  decidedById: string;
  decidedByName: string;
  /** ISO timestamp. */
  decidedAt: string;
  supersedesDecisionId?: string;
}

export interface DecisionInput {
  kind: string;
  note: string;
  reviewBy?: string;
}

export function isDecisionKind(value: string): value is DecisionKind {
  return (DECISION_KINDS as readonly string[]).includes(value);
}

export function isDecisionSubjectKind(value: string): value is DecisionSubjectKind {
  return (DECISION_SUBJECT_KINDS as readonly string[]).includes(value);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date: the string must round-trip, so 2026-02-30 is refused. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Adds whole days to an ISO date and returns an ISO date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Maximum review horizon for any decision. Longer gaps hide drift. */
export const MAX_REVIEW_DAYS = 365;
export const MIN_NOTE_LENGTH = 10;

/** Validates a decision before it is written. `asOf` is an ISO date. */
export function validateDecision(
  input: DecisionInput,
  asOf: string,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isDecisionKind(input.kind)) {
    errors.push(`Decision kind must be one of: ${DECISION_KINDS.join(", ")}.`);
  }
  if (typeof input.note !== "string" || input.note.trim().length < MIN_NOTE_LENGTH) {
    errors.push(`Decision note must say why, in at least ${MIN_NOTE_LENGTH} characters.`);
  }
  if (input.kind === "retire" && input.reviewBy != null) {
    errors.push("A retired decision carries no review date; nothing is left to review.");
  }
  if (input.reviewBy != null) {
    if (!isIsoDate(input.reviewBy)) {
      errors.push("Review date must be an ISO date (YYYY-MM-DD).");
    } else if (input.reviewBy <= asOf) {
      errors.push("Review date must be after today.");
    } else if (input.reviewBy > addDays(asOf, MAX_REVIEW_DAYS)) {
      errors.push(`Review date must be within ${MAX_REVIEW_DAYS} days.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * A decision that lets a critical-conflict grant proceed: it accepts the
 * residual or names a compensating control, says why, and sets a review
 * date. Remediate, monitor, and insure do not license a new conflict.
 */
export function decisionPermitsGrant(
  input: DecisionInput,
  asOf: string,
): { ok: boolean; errors: string[] } {
  const base = validateDecision(input, asOf);
  const errors = [...base.errors];
  if (input.kind !== "accept_residual" && input.kind !== "compensate") {
    errors.push(
      "A grant that creates a critical conflict needs an accept_residual or compensate decision.",
    );
  }
  if (input.reviewBy == null) {
    errors.push("A grant decision must carry a review date.");
  }
  return { ok: errors.length === 0, errors };
}

/** Decisions that no later decision has superseded. */
export function activeDecisions(decisions: ControlDecision[]): ControlDecision[] {
  const superseded = new Set(
    decisions.map((d) => d.supersedesDecisionId).filter((id): id is string => Boolean(id)),
  );
  return decisions.filter((d) => !superseded.has(d.id));
}

/**
 * The decision that governs a subject: the latest active one. A retirement
 * is itself the latest active row, and it says nothing governs, so the
 * subject reads as undecided.
 */
export function latestDecisionFor(
  decisions: ControlDecision[],
  subjectKind: DecisionSubjectKind,
  subjectId: string,
): ControlDecision | undefined {
  const latest = activeDecisions(decisions)
    .filter((d) => d.subjectKind === subjectKind && d.subjectId === subjectId)
    .sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : a.decidedAt > b.decidedAt ? -1 : 0))[0];
  return latest?.kind === "retire" ? undefined : latest;
}

// ---------------------------------------------------------------------------
// Reviewing a decision that has come due (docs/13 item 21)
// ---------------------------------------------------------------------------

export const REVIEW_ACTIONS = ["keep", "tighten", "retire"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/** Keep: the same decision, reviewed again this many days out. */
export const KEEP_DAYS = 90;
/** Tighten: remediate, reviewed again this many days out. */
export const TIGHTEN_DAYS = 30;

export function isReviewAction(value: string): value is ReviewAction {
  return (REVIEW_ACTIONS as readonly string[]).includes(value);
}

export type ReviewPlan = {
  kind: DecisionKind;
  note: string;
  reviewBy?: string;
  supersedesDecisionId: string;
};

/**
 * What a review writes, as one superseding row. Keep carries the kind and
 * the note forward for KEEP_DAYS (reversible: the next review can change
 * it). Tighten replaces it with remediate, the one response that licenses
 * nothing, for TIGHTEN_DAYS, and needs a note saying what tightens. Retire
 * ends it: a retire row with a note and no review date, after which the
 * subject is undecided again. Nothing here renews anything on its own.
 */
export function reviewPlan(
  prior: Pick<ControlDecision, "id" | "kind" | "note">,
  action: ReviewAction,
  asOf: string,
  note?: string,
): { ok: true; plan: ReviewPlan } | { ok: false; errors: string[] } {
  if (prior.kind === "retire") {
    return { ok: false, errors: ["A retired decision cannot be reviewed; record a new decision on the subject instead."] };
  }
  const given = note?.trim() ?? "";
  switch (action) {
    case "keep":
      return {
        ok: true,
        plan: { kind: prior.kind, note: given.length >= MIN_NOTE_LENGTH ? given : prior.note, reviewBy: addDays(asOf, KEEP_DAYS), supersedesDecisionId: prior.id },
      };
    case "tighten":
      if (given.length < MIN_NOTE_LENGTH) {
        return { ok: false, errors: [`Tightening needs a note saying what tightens, in at least ${MIN_NOTE_LENGTH} characters.`] };
      }
      return { ok: true, plan: { kind: "remediate", note: given, reviewBy: addDays(asOf, TIGHTEN_DAYS), supersedesDecisionId: prior.id } };
    case "retire":
      if (given.length < MIN_NOTE_LENGTH) {
        return { ok: false, errors: [`Retiring needs a note saying why, in at least ${MIN_NOTE_LENGTH} characters.`] };
      }
      return { ok: true, plan: { kind: "retire", note: given, supersedesDecisionId: prior.id } };
  }
}

/** Active decisions whose review date has passed. */
export function overdueReviews(decisions: ControlDecision[], asOf: string): ControlDecision[] {
  return activeDecisions(decisions).filter((d) => d.reviewBy != null && d.reviewBy < asOf);
}

export interface DecisionCoverage {
  open: DetectedConflict[];
  decided: { conflict: DetectedConflict; decision: ControlDecision }[];
  overdue: { conflict: DetectedConflict; decision: ControlDecision }[];
  /** 0–100: share of conflicts with a current, unexpired decision. */
  coveragePct: number;
}

/**
 * The current decision that governs a conflict: one on the finding itself,
 * or, failing that, one on the control its rule belongs to. A control-wide
 * decision is how the engine's residualRiskAccepted flag is set, so the
 * coverage count must honour it too, or one snapshot would call the same
 * conflict both accepted and undecided.
 */
export function governingDecision(
  conflict: Pick<DetectedConflict, "id" | "ruleId">,
  decisions: ControlDecision[],
): ControlDecision | undefined {
  const own = latestDecisionFor(decisions, "sod_finding", conflict.id);
  if (own) return own;
  const controlId = controlIdForRule(conflict.ruleId);
  return controlId ? latestDecisionFor(decisions, "control", controlId) : undefined;
}

/** Which detected conflicts carry a current decision, and which reviews are overdue. */
export function decisionCoverage(
  conflicts: DetectedConflict[],
  decisions: ControlDecision[],
  asOf: string,
): DecisionCoverage {
  const open: DetectedConflict[] = [];
  const decided: DecisionCoverage["decided"] = [];
  const overdue: DecisionCoverage["overdue"] = [];
  for (const conflict of conflicts) {
    const decision = governingDecision(conflict, decisions);
    if (!decision) {
      open.push(conflict);
    } else if (decision.reviewBy != null && decision.reviewBy < asOf) {
      overdue.push({ conflict, decision });
    } else {
      decided.push({ conflict, decision });
    }
  }
  const total = conflicts.length;
  const coveragePct = total === 0 ? 100 : Math.round((decided.length / total) * 100);
  return { open, decided, overdue, coveragePct };
}
