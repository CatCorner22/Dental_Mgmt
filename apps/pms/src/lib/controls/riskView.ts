import {
  DECISION_KIND_LABEL,
  governingDecision,
  latestDecisionFor,
  type ControlDecision,
  type CoverageStatus,
  type DetectedConflict,
} from "@pms/controls-engine";
import type { ReasonCodeRow, ReasonKind } from "../ledger/reasons";
import { CHANNEL_FOR_REASON_KIND, effectiveThresholdCents } from "../ledger/reasonThreshold";

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

// ---------------------------------------------------------------------------
// Reason thresholds beside the channel coverage they tighten (Increment 1.48)
// ---------------------------------------------------------------------------

/**
 * One reason code's own dual-release threshold, read against the channel figure
 * it tightens.
 *
 * The coverage table says what a channel holds. A reason code may hold a
 * channel to less than that (Increment 1.46), and the practice may loosen what
 * it holds only under a decision (Increment 1.47) — so a reader of the coverage
 * table who cannot see the reasons is reading a figure that no longer governs
 * every posting on that channel. That is the same fault the table's own
 * sentence disclaims: it must not show a green it does not have.
 */
export type ReasonTightening = {
  code: string;
  label: string;
  /** The reason's own figure in cents. A reason holding no figure tightens nothing and never appears here. */
  cents: number;
  /** What governs a posting under this reason: the lesser of the reason's figure and the channel's. */
  effectiveCents: number;
  /** True where the reason's figure is not below the channel's, so it changes nothing today. */
  redundant: boolean;
  /** The decision standing on this reason, where the practice loosened it and the decision still stands. */
  decision: ControlDecision | null;
};

/**
 * The reason codes that hold one channel to less than its own figure, loosest
 * first. Retired codes are left out: they reach no form, so they hold nothing.
 */
export function reasonTighteningsForChannel(input: {
  channel: string;
  channelThresholdUsd: number;
  rows: ReasonCodeRow[];
  decisions: ControlDecision[];
}): ReasonTightening[] {
  const channelCents = Math.round(input.channelThresholdUsd * 100);
  return input.rows
    .filter(
      (r) =>
        r.active &&
        r.requiresApprovalOverCents !== null &&
        CHANNEL_FOR_REASON_KIND[r.kind as ReasonKind] === input.channel
    )
    .map((r) => {
      const cents = r.requiresApprovalOverCents as number;
      const effectiveCents = effectiveThresholdCents(channelCents, cents);
      return {
        code: r.code,
        label: r.label,
        cents,
        effectiveCents,
        redundant: effectiveCents === channelCents,
        decision: latestDecisionFor(input.decisions, "reason_code", r.code) ?? null,
      };
    })
    .sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
}

/** A figure in cents as the page writes money: `$150`, `$1,250.50`, `every one`. */
export function centsPhrase(cents: number): string {
  if (cents === 0) return "every one";
  const usd = cents / 100;
  return `$${usd.toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** What one reason holds this channel to, in a sentence the coverage row can carry. */
export function reasonTighteningSentence(t: ReasonTightening): string {
  const head = t.redundant
    ? `${t.label}: ${centsPhrase(t.cents)} — not below the channel, so it holds nothing extra today`
    : `${t.label}: ${centsPhrase(t.cents)}`;
  if (!t.decision) return head;
  const review = t.decision.reviewBy ? `, review by ${t.decision.reviewBy}` : "";
  return `${head} · loosened under ${DECISION_KIND_LABEL[t.decision.kind]} by ${t.decision.decidedByName}${review}`;
}

/**
 * The month the coverage table names an attestation for: the last one that has
 * ended (Increment 1.51). Re-exported from the pure module the owner board also
 * reads (Increment 1.52), so the two surfaces cannot disagree about January.
 */
export { lastCompleteMonth } from "./attestationCoverage";

/**
 * What the coverage table says about a channel the product cannot enforce.
 * Where nobody has said anything, it says that rather than leaving the row to
 * read as though "attested" meant somebody had.
 */
export function attestationSentence(
  attestation: { byName: string; seat: string; at: string } | null,
  month: string
): string {
  if (!attestation) return `Nobody has reviewed ${month}.`;
  const who = attestation.seat === "accountant" ? "the accountant" : "the practice itself";
  return `Reviewed for ${month} by ${attestation.byName} (${who}) on ${attestation.at.slice(0, 10)}.`;
}
