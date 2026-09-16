export { CONTROL_RULEBOOK_VERSION, SCORING_VERSION } from "./version";
export type { PracticeState } from "./practice-state";
export { withStaff } from "./practice-state";

export { ROLE_TEMPLATES, detectSodConflicts, buildAssignments } from "./sod/detect";
export { CONFLICT_RULES, ENTITLEMENTS } from "./sod/conflict-rules";
export type { RoleAssignment, DetectedConflict, SodDetectionReport } from "./sod/detect";

export {
  DEFAULT_DUAL_RELEASE_RULES,
  evaluateRelease,
  resolveEffectiveThreshold,
  defaultDualReleasePolicy,
  mergeDualReleasePolicy,
  mitigatedSodRuleIds,
} from "./controls/dual-release";
export type {
  DualReleasePolicy,
  ReleaseChannel,
  ReleaseEvaluation,
  ReleaseRequest,
  ThresholdException,
} from "./controls/dual-release";
export type { Person, StaffComposition } from "./types";

export { assessCoso } from "./coso";
export type { CosoComponentAssessment } from "./coso";

export { scoreAllResidualRisks, portfolioSummary } from "./scoring/residual-engine";
export type { ResidualRiskScore } from "./scoring/residual-engine";

export { scoreLeadingIndicators } from "./signals/leading-indicators";
export { beamSearchLevers } from "./llm/reasoning/beam-search";
export { runCounterfactuals } from "./llm/reasoning/counterfactual";

export { findKnowledgeRisks, runPrecogScenario, rankDangerousScenarios } from "./engine";
export { tornadoSensitivity } from "./scoring/residual-engine";
export { simulateAllCascades, simulateCascadeLever, CASCADE_LEVERS } from "./scoring/variable-cascade";
export type { CascadeLeverId, CascadeSimulation } from "./scoring/variable-cascade";
export { compareScenarioFutures, compareScenarios } from "./scoring/scenario-compare";
export {
  dualReleaseCoverage,
  activeExceptionSummary,
  listEligibleApprovers,
  matchExceptions,
} from "./controls/dual-release";
export type { ExceptionAction, ExceptionScope, ReleaseStatus } from "./controls/dual-release";

export { ENTITLEMENT_IDS, isEntitlementId, assignmentsFromGrants, evaluateGrant } from "./grants";
export type { GrantRow, GrantRequest, GrantEvaluation, AssignmentsFromGrants } from "./grants";
export type { EntitlementId, ConflictRule, DutyFamily } from "./sod/conflict-rules";

export {
  DECISION_KINDS,
  DECISION_SUBJECT_KINDS,
  DECISION_KIND_LABEL,
  MAX_REVIEW_DAYS,
  isDecisionKind,
  isDecisionSubjectKind,
  isIsoDate,
  addDays,
  validateDecision,
  decisionPermitsGrant,
  activeDecisions,
  latestDecisionFor,
  overdueReviews,
  decisionCoverage,
} from "./decisions";
export type {
  DecisionKind,
  DecisionSubjectKind,
  ControlDecision,
  DecisionInput,
  DecisionCoverage,
} from "./decisions";

export {
  RELEASE_CHANNELS,
  isReleaseChannel,
  channelCoverage,
  mitigatedRuleIdsForScoring,
  dualControlPaymentsFromCoverage,
} from "./coverage";
export type { Enforcement, EnforcementByChannel, ChannelCoverageRow, CoverageStatus } from "./coverage";

export { MAX_WAIVE_DAYS, validateThresholdException } from "./exceptions";

export {
  buildPracticeState,
  deriveControlsRegistry,
  deriveStaffComposition,
  controlDecisionInputs,
} from "./practice-state-builder";
export type { BuildPracticeStateInput, BuiltPracticeState } from "./practice-state-builder";

export { takeControlSnapshot } from "./snapshot";
export type { ControlSnapshot } from "./snapshot";

export {
  SCENARIO_TEMPLATES,
  CONTROL_TEMPLATES,
  ILLUSTRATIVE_CRIME_STATS,
} from "./templates";
export type { ControlTemplate } from "./templates";
export type { ControlItem, ScenarioTemplate, CrimeFraudStats, KnowledgeItem, KnowledgeRelation } from "./types";
export {
  DEFAULT_RISK_VARIABLES,
  mergeStaffIntoVariables,
  applyVariablesToStaff,
} from "./scoring/dynamic-variables";
export type { RiskVariableState } from "./scoring/dynamic-variables";
