/**
 * Builds a PracticeState from live tenant rows. The engine never reads demo
 * data; the app hands it people, grants, the active policy, and decisions,
 * and this module assembles what every scorer expects.
 *
 * Staff composition is derived, not typed in:
 *   team size            = active people
 *   segregation score    = segregationHealth from the live SoD report
 *   dual control         = an enabled, counted payment channel
 *   independent bank rec = measured by reconciliation runs when the product
 *                          holds them; false until then (never assumed)
 *   sole-owner knowledge = knowledge risks when a knowledge map exists; 0 until then
 */
import type { DualReleasePolicy } from "./controls/dual-release";
import {
  channelCoverage,
  dualControlPaymentsFromCoverage,
  mitigatedRuleIdsForScoring,
  type ChannelCoverageRow,
  type EnforcementByChannel,
} from "./coverage";
import { activeDecisions, governingDecision, type ControlDecision } from "./decisions";
import { findKnowledgeRisks } from "./engine";
import { assignmentsFromGrants, type GrantRow } from "./grants";
import type { PracticeState } from "./practice-state";
import { detectSodConflicts, type RoleAssignment, type SodDetectionReport } from "./sod/detect";
import { CONTROL_TEMPLATES, ILLUSTRATIVE_CRIME_STATS, SCENARIO_TEMPLATES } from "./templates";
import type {
  ControlItem,
  KnowledgeItem,
  KnowledgeRelation,
  Person,
  StaffComposition,
} from "./types";

export interface BuildPracticeStateInput {
  people: Person[];
  grants: GrantRow[];
  policy: DualReleasePolicy;
  decisions: ControlDecision[];
  enforcement: EnforcementByChannel;
  /** ISO date the state is built for. */
  asOf: string;
  /** Measured by reconciliation runs; pass false when none exist. */
  independentBankRec?: boolean;
  knowledge?: KnowledgeItem[];
  relations?: KnowledgeRelation[];
}

export interface BuiltPracticeState {
  state: PracticeState;
  sod: SodDetectionReport;
  assignments: RoleAssignment[];
  unknownEntitlements: { personId: string; entitlement: string }[];
  coverage: ChannelCoverageRow[];
  mitigatedRuleIds: string[];
  /** What the detector should credit, for callers that re-run it. */
  detectOptions: {
    dualReleaseMitigatedRuleIds: Set<string>;
    residualAcceptedControlIds: Set<string>;
    compensatingByControlId: Record<string, string[]>;
  };
}

/**
 * Residual-accepted control ids and compensating notes from decisions.
 *
 * The engine's flags are control-wide, so only a decision whose subject is
 * the control feeds them directly. A decision on one person's finding never
 * fans out to other people's conflicts on the same control; a control counts
 * as residual-accepted from findings only when every one of its live
 * conflicts carries a current accept_residual decision.
 */
export function controlDecisionInputs(
  decisions: ControlDecision[],
  sodConflicts?: SodDetectionReport["conflicts"],
): {
  residualAcceptedControlIds: Set<string>;
  compensatingByControlId: Record<string, string[]>;
} {
  const residualAcceptedControlIds = new Set<string>();
  const compensatingByControlId: Record<string, string[]> = {};
  for (const d of activeDecisions(decisions)) {
    if (d.subjectKind !== "control") continue;
    if (d.kind === "accept_residual") residualAcceptedControlIds.add(d.subjectId);
    if (d.kind === "compensate") (compensatingByControlId[d.subjectId] ??= []).push(d.note);
  }
  if (sodConflicts) {
    for (const t of CONTROL_TEMPLATES) {
      const live = sodConflicts.filter((c) => t.ruleIds.includes(c.ruleId));
      if (live.length === 0) continue;
      const allAccepted = live.every(
        (c) => governingDecision(c, decisions)?.kind === "accept_residual",
      );
      if (allAccepted) residualAcceptedControlIds.add(t.id);
    }
  }
  return { residualAcceptedControlIds, compensatingByControlId };
}

/** The typed controls registry as ControlItem[] for the residual engine. */
export function deriveControlsRegistry(
  sod: SodDetectionReport,
  coverage: ChannelCoverageRow[],
  decisions: ControlDecision[],
): ControlItem[] {
  const inputs = controlDecisionInputs(decisions, sod.conflicts);
  return CONTROL_TEMPLATES.map((t) => {
    const live = sod.conflicts.filter((c) => t.ruleIds.includes(c.ruleId));
    const channelNotes = coverage
      .filter((row) => row.countsTowardScores && row.mitigatesRuleIds.some((id) => t.ruleIds.includes(id)))
      .map((row) => `Dual release on ${row.label}${row.thresholdUsd > 0 ? ` above $${row.thresholdUsd.toLocaleString()}` : ""}`);
    const compensating = Array.from(
      new Set([...channelNotes, ...(inputs.compensatingByControlId[t.id] ?? [])]),
    );
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      duties: [...t.duties],
      segregated: live.length === 0,
      compensatingControls: compensating,
      residualRiskAccepted: inputs.residualAcceptedControlIds.has(t.id),
    };
  });
}

export function deriveStaffComposition(input: {
  people: Person[];
  sod: SodDetectionReport;
  coverage: ChannelCoverageRow[];
  independentBankRec: boolean;
  soleOwnerKnowledgeCount: number;
}): StaffComposition {
  const active = input.people.filter((p) => p.active);
  const tenure =
    active.length === 0
      ? 0
      : active.reduce((s, p) => s + (Number.isFinite(p.tenureYears) ? p.tenureYears : 0), 0) /
        active.length;
  return {
    teamSize: active.length,
    soleOwnerKnowledgeCount: input.soleOwnerKnowledgeCount,
    avgTenureYears: Math.round(tenure * 10) / 10,
    segregationScore: input.sod.summary.segregationHealth,
    dualControlPayments: dualControlPaymentsFromCoverage(input.coverage),
    independentBankRec: input.independentBankRec,
  };
}

export function buildPracticeState(input: BuildPracticeStateInput): BuiltPracticeState {
  const coverage = channelCoverage(input.policy, input.enforcement, input.asOf);
  const mitigated = mitigatedRuleIdsForScoring(input.policy, input.enforcement, input.asOf);
  const { assignments, unknownEntitlements } = assignmentsFromGrants(
    input.people,
    input.grants,
    input.asOf,
  );
  const knowledge = input.knowledge ?? [];
  const relations = input.relations ?? [];

  // The detector needs a staff composition for its uplifts. Build a first
  // pass without one, derive staff from it, then detect again so the
  // scores the app persists are the ones the staff line was derived from.
  const seed: PracticeState = {
    people: input.people,
    knowledge,
    relations,
    controls: [],
    scenarios: SCENARIO_TEMPLATES,
    staff: {
      teamSize: input.people.filter((p) => p.active).length,
      soleOwnerKnowledgeCount: 0,
      avgTenureYears: 0,
      segregationScore: 100,
      dualControlPayments: dualControlPaymentsFromCoverage(coverage),
      independentBankRec: input.independentBankRec ?? false,
    },
    crimeStats: ILLUSTRATIVE_CRIME_STATS,
  };
  const firstInputs = controlDecisionInputs(input.decisions);
  const firstPass = detectSodConflicts(seed, {
    assignments,
    dualReleaseMitigatedRuleIds: mitigated,
    ...firstInputs,
  });
  const soleOwnerKnowledgeCount =
    knowledge.length === 0
      ? 0
      : findKnowledgeRisks({ ...seed, controls: [] }).filter((r) => r.soleOwner).length;
  const staff = deriveStaffComposition({
    people: input.people,
    sod: firstPass,
    coverage,
    independentBankRec: input.independentBankRec ?? false,
    soleOwnerKnowledgeCount,
  });
  const detectOptions = {
    dualReleaseMitigatedRuleIds: mitigated,
    ...controlDecisionInputs(input.decisions, firstPass.conflicts),
  };
  const sod = detectSodConflicts({ ...seed, staff }, { assignments, ...detectOptions });
  const controls = deriveControlsRegistry(sod, coverage, input.decisions);
  const state: PracticeState = { ...seed, controls, staff };
  return {
    state,
    sod,
    assignments,
    unknownEntitlements,
    coverage,
    mitigatedRuleIds: Array.from(mitigated).sort(),
    detectOptions,
  };
}
