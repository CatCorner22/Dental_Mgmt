import {
  buildPracticeState,
  mergeDualReleasePolicy,
  type BuiltPracticeState,
  type ControlDecision,
  type DualReleasePolicy,
} from "@pms/controls-engine";
import type { AppDb } from "../db/client";
import { listDecisions } from "./decisions";
import { ENFORCEMENT } from "./enforcement";
import { loadActivePolicy, type ActivePolicy } from "./policy";
import { measureReconciliation, type ReconciliationMeasurement } from "./reconciliationMeasure";
import { loadStaff, type LoadedStaff } from "./staff";

export type ControlsContext = {
  tenantId: string;
  now: Date;
  asOf: string;
  /** Null when the tenant has never seeded a policy; scoring then treats dual release as off. */
  active: ActivePolicy | null;
  policy: DualReleasePolicy;
  staff: LoadedStaff;
  decisions: ControlDecision[];
  /** Independent bank reconciliation as measured from cleared runs; never assumed. */
  reconciliation: ReconciliationMeasurement;
  built: BuiltPracticeState;
};

/**
 * Everything the engine needs, from live rows only: users and their grants,
 * the active dual-release policy, the decision register, and independent
 * bank reconciliation measured from the cleared reconciliation runs.
 */
export async function loadControlsContext(db: AppDb, tenantId: string, now: Date = new Date()): Promise<ControlsContext> {
  // One transaction client: queries run in sequence, never interleaved.
  const active = await loadActivePolicy(db, tenantId);
  const staff = await loadStaff(db, tenantId, now);
  const decisions = await listDecisions(db, tenantId);
  const reconciliation = await measureReconciliation(db, tenantId, now);
  const policy = active?.policy ?? mergeDualReleasePolicy({ enabled: false, exceptions: [] });
  const asOf = now.toISOString().slice(0, 10);
  const built = buildPracticeState({
    people: staff.people,
    grants: staff.grants,
    policy,
    decisions,
    enforcement: ENFORCEMENT,
    asOf,
    independentBankRec: reconciliation.independentBankRec,
  });
  return { tenantId, now, asOf, active, policy, staff, decisions, reconciliation, built };
}
