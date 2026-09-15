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

export { findKnowledgeRisks, runPrecogScenario } from "./engine";
export {
  DEFAULT_RISK_VARIABLES,
  mergeStaffIntoVariables,
  applyVariablesToStaff,
} from "./scoring/dynamic-variables";
export type { RiskVariableState } from "./scoring/dynamic-variables";
