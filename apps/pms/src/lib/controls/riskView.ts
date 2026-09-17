import {
  DECISION_KIND_LABEL,
  governingDecision,
  type ControlDecision,
  type CoverageStatus,
  type DetectedConflict,
} from "@pms/controls-engine";

/**
 * Pure view helpers for the Practice Risk page. Everything here is a
 * sentence or a label derived from engine output; nothing here scores.
 */

export const ENFORCEMENT_LABEL: Record<CoverageStatus, string> = {
  enforced: "Enforced",
  partial: "Partial",
  recorded: "Recorded",
  external: "Attested (external)",
  off: "Off",
};

export const ENFORCEMENT_HELP: Record<CoverageStatus, string> = {
  enforced: "Runs inside the write path; a refusal rolls the action back. Counts toward scores.",
  partial: "Runs for patient-ledger kinds only; the rest of this channel is not held. Earns no credit.",
  recorded: "Evaluated and logged on request; the release happens elsewhere. Counts toward scores.",
  external: "The product does not hold this data. Shown as attested, never enforced; excluded from scores.",
  off: "The policy has this channel switched off.",
};

export const SEVERITY_LABEL: Record<DetectedConflict["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  family: "Same family",
};

export type DecisionState =
  | { state: "open" }
  | { state: "decided"; decision: ControlDecision }
  | { state: "overdue"; decision: ControlDecision };

/** Which decision governs a conflict today, and whether its review date has passed. */
export function conflictDecisionState(
  conflict: Pick<DetectedConflict, "id" | "ruleId">,
  decisions: ControlDecision[],
  asOf: string
): DecisionState {
  const decision = governingDecision(conflict, decisions);
  if (!decision) return { state: "open" };
  if (decision.reviewBy && decision.reviewBy < asOf) return { state: "overdue", decision };
  return { state: "decided", decision };
}

export function decisionStateLabel(s: DecisionState): string {
  switch (s.state) {
    case "open":
      return "No decision yet";
    case "overdue":
      return `${DECISION_KIND_LABEL[s.decision.kind]} · review was due ${s.decision.reviewBy}`;
    case "decided":
      return s.decision.reviewBy
        ? `${DECISION_KIND_LABEL[s.decision.kind]} · review by ${s.decision.reviewBy}`
        : DECISION_KIND_LABEL[s.decision.kind];
  }
}

/** One sentence on where the numbers came from. */
export function provenanceSentence(input: {
  source: "stored" | "live";
  takenAt: string;
  trigger: string;
  scoringVersion: string;
  rulebookVersion: string;
}): string {
  const when = new Date(input.takenAt).toLocaleString();
  const origin =
    input.source === "live"
      ? "Computed from live rows just now, not frozen."
      : `Frozen ${when} (${input.trigger}).`;
  return `${origin} Scoring ${input.scoringVersion}, rulebook ${input.rulebookVersion}. Directional until a CPA calibrates the weights.`;
}

/** The refusal body a grant route returns, normalised for the Refusal component. */
export type GrantRefusalBody = {
  error?: string;
  code?: string;
  nextSteps?: string[];
  conflicts?: Pick<DetectedConflict, "id" | "title" | "personName" | "severity">[];
};

export function grantRefusal(body: GrantRefusalBody, status: number) {
  const verb =
    body.code === "sod_critical_conflict"
      ? "Needs a control decision before this grant"
      : body.code === "self_grant_requires_second_admin"
        ? "Needs a different administrator"
        : body.code === "decision_invalid"
          ? "The decision does not license this grant"
          : body.code === "already_granted"
            ? "Already granted"
            : status === 404
              ? "Not in this practice"
              : "Not granted";
  return {
    verb,
    why: body.error ?? "The grant was refused.",
    nextSteps: body.nextSteps ?? [],
    conflicts: (body.conflicts ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      personName: c.personName,
      severity: SEVERITY_LABEL[c.severity] ?? c.severity,
    })),
    /** Only an unmitigated critical conflict can be licensed by a decision in the same request. */
    canLicense: body.code === "sod_critical_conflict",
  };
}

/** Duties held per person, sorted by name, from the engine's assignments. */
export function dutiesByPerson<T extends { personId: string; personName: string; role: string; entitlements: string[] }>(
  assignments: T[]
): T[] {
  return [...assignments].sort((a, b) => a.personName.localeCompare(b.personName));
}
