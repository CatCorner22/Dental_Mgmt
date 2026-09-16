import type {
  ControlItem,
  CrimeFraudStats,
  KnowledgeItem,
  KnowledgeRelation,
  Person,
  ProcessNode,
  ScenarioTemplate,
  StaffComposition,
} from "./types";

/**
 * Live practice snapshot for every controls-engine function.
 * Built from tenant rows by the app — never from demo-data.
 */
export interface PracticeState {
  people: Person[];
  knowledge: KnowledgeItem[];
  relations: KnowledgeRelation[];
  controls: ControlItem[];
  scenarios: ScenarioTemplate[];
  staff: StaffComposition;
  crimeStats: CrimeFraudStats;
  processes?: ProcessNode[];
}

export function withStaff(
  state: PracticeState,
  staff: StaffComposition,
): PracticeState {
  return { ...state, staff };
}
