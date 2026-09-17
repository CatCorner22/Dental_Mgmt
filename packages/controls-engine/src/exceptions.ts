/**
 * Validation for threshold exceptions before a policy version is written.
 * Exceptions need the owner role (checked by the app), a reason, and — for
 * anything that loosens a control — a residual note and a window. A waiver
 * always expires.
 */
import type { ThresholdException } from "./controls/dual-release";
import { isReleaseChannel } from "./coverage";
import { addDays, isIsoDate, validateDecision, type DecisionInput } from "./decisions";

/** Longest a waiver may stand before someone must look at it again. */
export const MAX_WAIVE_DAYS = 90;

export const EXCEPTION_ACTIONS = [
  "raise_threshold",
  "lower_threshold",
  "force_dual",
  "waive_dual",
] as const;

const OPTIONAL_STRING_FIELDS = ["payeeContains", "personId", "role", "residualNote", "approvedByPersonId"] as const;

export function validateThresholdException(
  ex: ThresholdException,
  asOf: string,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!ex.id || typeof ex.id !== "string") errors.push("Exception needs an id.");
  if (typeof ex.label !== "string" || !ex.label.trim()) errors.push("Exception needs a label.");
  if (typeof ex.reason !== "string" || !ex.reason.trim()) errors.push("Exception needs a reason.");
  if (!(EXCEPTION_ACTIONS as readonly string[]).includes(ex.action)) {
    errors.push(`Exception action must be one of: ${EXCEPTION_ACTIONS.join(", ")}.`);
  }
  if (typeof ex.enabled !== "boolean") errors.push("Exception enabled must be true or false.");
  if (ex.outsideBusinessHours != null && typeof ex.outsideBusinessHours !== "boolean") {
    errors.push("outsideBusinessHours must be true or false when present.");
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    const v = ex[field];
    if (v != null && (typeof v !== "string" || !v.trim())) {
      errors.push(`${field} must be a non-empty string when present.`);
    }
  }
  if (!Array.isArray(ex.channels)) {
    errors.push("Exception channels must be a list (empty = all channels).");
  } else {
    for (const c of ex.channels) {
      if (!isReleaseChannel(c)) errors.push(`Unknown channel "${c}".`);
    }
  }

  const loosens = ex.action === "raise_threshold" || ex.action === "waive_dual";
  if (loosens && !ex.residualNote?.trim()) {
    errors.push("A raise or waiver needs a residual note.");
  }
  if (loosens && !ex.approvedByPersonId) {
    errors.push("A raise or waiver needs the approving owner's id.");
  }

  if (ex.action === "raise_threshold" || ex.action === "lower_threshold") {
    if (typeof ex.thresholdUsd !== "number" || !Number.isFinite(ex.thresholdUsd) || ex.thresholdUsd < 0) {
      errors.push("A raise or lower needs a finite, non-negative threshold in USD.");
    }
  } else if (ex.thresholdUsd != null) {
    errors.push("Only raise_threshold and lower_threshold carry a threshold.");
  }

  if (ex.effectiveFrom != null && !isIsoDate(ex.effectiveFrom)) {
    errors.push("effectiveFrom must be an ISO date.");
  }
  if (ex.effectiveTo != null && !isIsoDate(ex.effectiveTo)) {
    errors.push("effectiveTo must be an ISO date.");
  }
  if (isIsoDate(ex.effectiveFrom) && isIsoDate(ex.effectiveTo) && ex.effectiveFrom > ex.effectiveTo) {
    errors.push("effectiveFrom must not be after effectiveTo.");
  }
  if (ex.action === "waive_dual") {
    if (!isIsoDate(ex.effectiveTo)) {
      errors.push("A waiver must carry an effectiveTo date; waivers always expire.");
    } else if (ex.effectiveTo > addDays(asOf, MAX_WAIVE_DAYS)) {
      errors.push(`A waiver may stand at most ${MAX_WAIVE_DAYS} days.`);
    } else if (ex.effectiveTo < asOf) {
      errors.push("A waiver's effectiveTo is already in the past.");
    }
  }

  if (ex.amountMinUsd != null && ex.amountMaxUsd != null && ex.amountMinUsd > ex.amountMaxUsd) {
    errors.push("amountMinUsd must not exceed amountMaxUsd.");
  }
  for (const [k, v] of [
    ["amountMinUsd", ex.amountMinUsd],
    ["amountMaxUsd", ex.amountMaxUsd],
  ] as const) {
    if (v != null && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
      errors.push(`${k} must be a finite, non-negative number.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * An exception that tightens a control (Increment 1.31). Retiring it
 * loosens the control, so the app asks for a decision before it does.
 * Retiring a raise or a waiver tightens, and needs none.
 */
export function exceptionTightens(ex: Pick<ThresholdException, "action">): boolean {
  return ex.action === "force_dual" || ex.action === "lower_threshold";
}

/**
 * Switching a tightening control off is a decision the owner records, not a
 * settings change (docs/13 item 25): accept the residual or name what
 * compensates, say why, and set the day the practice looks at it again.
 */
export function decisionPermitsRetirement(
  input: DecisionInput,
  asOf: string,
): { ok: boolean; errors: string[] } {
  const base = validateDecision(input, asOf);
  const errors = [...base.errors];
  if (input.kind !== "accept_residual" && input.kind !== "compensate") {
    errors.push("Switching a tightening control off needs an accept_residual or compensate decision.");
  }
  if (input.reviewBy == null) {
    errors.push("Switching a tightening control off needs a review date: the day the practice looks at this again.");
  }
  return { ok: errors.length === 0, errors };
}
