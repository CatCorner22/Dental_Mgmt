/**
 * A control snapshot freezes every score the product shows, stamped with
 * the scoring and rulebook versions, so a later weight change never
 * regrades history. Pure and deterministic for a given state and clock.
 */
import { assessCoso } from "./coso";
import type { ChannelCoverageRow } from "./coverage";
import { decisionCoverage, overdueReviews, type ControlDecision } from "./decisions";
import type { PracticeState } from "./practice-state";
import type { RiskVariableState } from "./scoring/dynamic-variables";
import { portfolioSummary, tornadoSensitivity } from "./scoring/residual-engine";
import { scoreLeadingIndicators } from "./signals/leading-indicators";
import type { SodDetectionReport } from "./sod/detect";
import { CONTROL_RULEBOOK_VERSION, SCORING_VERSION } from "./version";

/**
 * Independent bank reconciliation as the product measured it: the grade
 * docs/05 names, over a window of cleared runs. Absent when the product
 * has not measured it, in which case the staff flag is an assumption.
 */
export interface ReconciliationMeasurementSummary {
  grade: "independent" | "same_hands" | "stale_import";
  windowDays: number;
  clearedInWindow: number;
  sameHandsInWindow: number;
  /** ISO timestamp of the latest cleared run in the window, or null. */
  latestClearedAt: string | null;
  /** One sentence a reader can act on. */
  why: string;
}

/**
 * Detection lag and the 48-hour match rate as the product measured them
 * from bank lines and the deposits they matched (docs/05: "detection lag
 * is measured in days between posting and matched bank transaction; match
 * rate within 48 hours is stored"). Recorded and shown; no score reads
 * them until a CPA calibrates a weight for them.
 */
export interface MatchingMeasurementSummary {
  windowDays: number;
  /** Calendar days a bank line has to match before it counts against the rate. */
  dueDays: number;
  /** Bank lines posted in the window that are at least dueDays old. */
  linesInWindow: number;
  /** Lines with money in; the only lines the matcher can pair with a deposit today. */
  creditsInWindow: number;
  creditsMatched: number;
  creditsMatchedWithinDue: number;
  /** Percent of credits matched within dueDays, or null when there were no credits. */
  matchRate48hPct: number | null;
  /** Median days from bank posting to the practice resolving the line, or null with no lines. */
  medianLagDays: number | null;
  maxLagDays: number | null;
  /** Lines still open as of the measurement; their lag is a lower bound. */
  openLines: number;
  /** One sentence a reader can act on. */
  why: string;
}

export interface SnapshotMeasurements {
  reconciliation?: ReconciliationMeasurementSummary;
  matching?: MatchingMeasurementSummary;
}

export interface ControlSnapshot {
  scoringVersion: string;
  rulebookVersion: string;
  /** ISO timestamp supplied by the caller. */
  takenAt: string;
  /** Present only for inputs the product measured rather than assumed. */
  measurements?: SnapshotMeasurements;
  headline: {
    averageResidual: number;
    criticalPath: number;
    actNow: number;
    cosoOverall: number;
    pressureIndex: number;
    pressureBand: string;
    segregationHealth: number;
    openConflicts: number;
    conflictsWithoutDecision: number;
    overdueReviews: number;
    unmitigatedCritical: number;
  };
  portfolio: ReturnType<typeof portfolioSummary>;
  coso: ReturnType<typeof assessCoso>;
  signals: ReturnType<typeof scoreLeadingIndicators>;
  tornado: ReturnType<typeof tornadoSensitivity>;
  sod: {
    summary: SodDetectionReport["summary"];
    recommendations: string[];
    conflicts: SodDetectionReport["conflicts"];
  };
  coverage: ChannelCoverageRow[];
  decisions: {
    coveragePct: number;
    openConflictIds: string[];
    overdue: { decisionId: string; subjectId: string; reviewBy: string }[];
  };
  staff: PracticeState["staff"];
  assumptions: string[];
}

export function takeControlSnapshot(input: {
  state: PracticeState;
  sod: SodDetectionReport;
  coverage: ChannelCoverageRow[];
  decisions: ControlDecision[];
  takenAt: string;
  vars?: RiskVariableState;
  measurements?: SnapshotMeasurements;
}): ControlSnapshot {
  const asOf = input.takenAt.slice(0, 10);
  const portfolio = portfolioSummary(input.state, input.vars);
  const coso = assessCoso(input.state);
  const signals = scoreLeadingIndicators(input.state, input.vars);
  const tornado = tornadoSensitivity(input.state);
  const cover = decisionCoverage(input.sod.conflicts, input.decisions, asOf);
  const overdue = overdueReviews(input.decisions, asOf);
  const external = input.coverage.filter((c) => c.enforcement === "external");
  const partial = input.coverage.filter((c) => c.enforcement === "partial");

  const recon = input.measurements?.reconciliation;
  const matching = input.measurements?.matching;

  return {
    scoringVersion: SCORING_VERSION,
    rulebookVersion: CONTROL_RULEBOOK_VERSION,
    takenAt: input.takenAt,
    ...(input.measurements ? { measurements: input.measurements } : {}),
    headline: {
      averageResidual: portfolio.averageResidual,
      criticalPath: portfolio.criticalPath,
      actNow: portfolio.actNow,
      cosoOverall: coso.overall,
      pressureIndex: signals.pressureIndex,
      pressureBand: signals.band,
      segregationHealth: input.sod.summary.segregationHealth,
      openConflicts: input.sod.conflicts.length,
      conflictsWithoutDecision: cover.open.length,
      overdueReviews: overdue.length,
      unmitigatedCritical: input.sod.summary.critical,
    },
    portfolio,
    coso,
    signals,
    tornado,
    sod: {
      summary: input.sod.summary,
      recommendations: input.sod.recommendations,
      conflicts: input.sod.conflicts,
    },
    coverage: input.coverage,
    decisions: {
      coveragePct: cover.coveragePct,
      openConflictIds: cover.open.map((c) => c.id),
      overdue: overdue.map((d) => ({
        decisionId: d.id,
        subjectId: d.subjectId,
        reviewBy: d.reviewBy ?? "",
      })),
    },
    staff: input.state.staff,
    assumptions: [
      "Scores are directional until a CPA calibrates the weights.",
      "Scores describe control design and residual risk, never a person.",
      ...(input.state.knowledge.length === 0
        ? ["No knowledge map yet: sole-owner knowledge counts as zero and knowledge risks are empty."]
        : []),
      ...(input.state.staff.independentBankRec
        ? []
        : recon
          ? [
              `Independent bank reconciliation is measured over the last ${recon.windowDays} days and is absent (${recon.grade.replace("_", " ")}): ${recon.why}`,
            ]
          : ["Independent bank reconciliation is not measured yet and is treated as absent."]),
      ...(matching
        ? [
            `Detection lag and the 48-hour match rate are measured over the last ${matching.windowDays} days and recorded, not scored: ${matching.why}`,
          ]
        : []),
      ...(partial.length
        ? [
            `${partial.map((c) => c.label).join(", ")}: enforced for patient-ledger kinds only; mitigates no SoD rule and earns no dual-control credit.`,
          ]
        : []),
      ...(external.length
        ? [
            `${external.map((c) => c.label).join(", ")}: external / attested, excluded from scores.`,
          ]
        : []),
    ],
  };
}
