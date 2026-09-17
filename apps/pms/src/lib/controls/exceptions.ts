import {
  activeExceptionSummary,
  channelCoverage,
  decisionPermitsRetirement,
  exceptionTightens,
  latestDecisionFor,
  validateThresholdException,
  type ChannelCoverageRow,
  type ControlDecision,
  type ThresholdException,
} from "@pms/controls-engine";
import type { AppDb } from "../db/client";
import { listDecisions, recordDecision, reviewDecision } from "./decisions";
import { ENFORCEMENT } from "./enforcement";
import { appendControlEvent } from "./events";
import { lockTenantPolicy } from "./locks";
import { loadActivePolicy, writePolicyVersion, type ActivePolicy } from "./policy";

export type ExceptionsView = {
  policyConfigured: boolean;
  policyVersion: number | null;
  enabled: boolean;
  coverage: ChannelCoverageRow[];
  exceptions: ThresholdException[];
  summary: ReturnType<typeof activeExceptionSummary>;
};

export async function listExceptions(db: AppDb, tenantId: string, now: Date = new Date()): Promise<ExceptionsView> {
  const active = await loadActivePolicy(db, tenantId);
  const asOf = now.toISOString().slice(0, 10);
  if (!active) {
    return {
      policyConfigured: false,
      policyVersion: null,
      enabled: false,
      coverage: [],
      exceptions: [],
      summary: { total: 0, raises: 0, forceDual: 0, waives: 0, expiringSoon: 0 },
    };
  }
  return {
    policyConfigured: true,
    policyVersion: active.version,
    enabled: active.policy.enabled,
    coverage: channelCoverage(active.policy, ENFORCEMENT, asOf),
    exceptions: active.policy.exceptions ?? [],
    summary: activeExceptionSummary(active.policy),
  };
}

export type ExceptionWriteResult =
  | { ok: true; policyVersion: number; exception: ThresholdException; decision?: ControlDecision }
  | {
      ok: false;
      status: 400 | 404 | 409;
      code: "invalid" | "no_policy" | "duplicate" | "not_found" | "needs_decision" | "already_off" | "already_on" | "not_restorable";
      errors: string[];
    };

/** The decision an owner records when switching a tightening exception off (Increment 1.31). */
export type RetirementDecision = { kind: string; note: string; reviewBy?: string };

type Actor = { id: string; name: string };

/**
 * Adds a threshold exception as a new policy version. The route requires
 * the admin rank; this function requires the exception to validate and,
 * for anything that loosens a control, to name the approving owner.
 */
export async function addException(
  db: AppDb,
  input: { tenantId: string; actor: Actor; exception: ThresholdException; now?: Date }
): Promise<ExceptionWriteResult> {
  const now = input.now ?? new Date();
  const asOf = now.toISOString().slice(0, 10);
  const ex: ThresholdException = {
    ...input.exception,
    createdAt: asOf,
    approvedByPersonId:
      input.exception.action === "raise_threshold" || input.exception.action === "waive_dual"
        ? input.actor.id
        : input.exception.approvedByPersonId,
  };
  const valid = validateThresholdException(ex, asOf);
  if (!valid.ok) return { ok: false, status: 400, code: "invalid", errors: valid.errors };

  await lockTenantPolicy(db, input.tenantId);
  const active = await loadActivePolicy(db, input.tenantId);
  if (!active) {
    return { ok: false, status: 404, code: "no_policy", errors: ["No control policy is configured for this practice."] };
  }
  if ((active.policy.exceptions ?? []).some((e) => e.id === ex.id)) {
    return { ok: false, status: 409, code: "duplicate", errors: [`An exception with id ${ex.id} already exists.`] };
  }

  const next = { ...active.policy, exceptions: [...(active.policy.exceptions ?? []), ex] };
  await writePolicyVersion(db, {
    tenantId: input.tenantId,
    version: active.version + 1,
    policy: next,
    createdById: input.actor.id,
    createdByName: input.actor.name,
    now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "control.policy_changed",
    {
      version: active.version + 1,
      change: "exception_added",
      exceptionId: ex.id,
      action: ex.action,
      channels: ex.channels,
      effectiveTo: ex.effectiveTo ?? null,
    },
    now
  );
  return { ok: true, policyVersion: active.version + 1, exception: ex };
}

/**
 * Retires an exception: disabled and ended today, in a new policy version.
 *
 * Retiring a raise or a waiver tightens a control and needs only a reason.
 * Retiring a tightening exception (a force_dual such as the after-hours
 * hold, or a lower_threshold) loosens one, so it is a control decision, not
 * a settings change (docs/13 item 25, Increment 1.31): the owner accepts the
 * residual or names what compensates, says why, and sets a review date. The
 * decision row, the policy version, and both chain events are written in the
 * caller's one transaction, and the decision's subject is the exception, so
 * the register and the owner home can say "off since, review due".
 */
export async function retireException(
  db: AppDb,
  input: { tenantId: string; actor: Actor; exceptionId: string; reason?: string; decision?: RetirementDecision; now?: Date }
): Promise<ExceptionWriteResult> {
  const now = input.now ?? new Date();
  const asOf = now.toISOString().slice(0, 10);
  await lockTenantPolicy(db, input.tenantId);
  const active: ActivePolicy | null = await loadActivePolicy(db, input.tenantId);
  if (!active) {
    return { ok: false, status: 404, code: "no_policy", errors: ["No control policy is configured for this practice."] };
  }
  const current = (active.policy.exceptions ?? []).find((e) => e.id === input.exceptionId);
  if (!current) {
    return { ok: false, status: 404, code: "not_found", errors: [`No exception with id ${input.exceptionId}.`] };
  }
  if (!current.enabled) {
    return { ok: false, status: 409, code: "already_off", errors: [`"${current.label}" is already off.`] };
  }

  const tightens = exceptionTightens(current);
  if (tightens && !input.decision) {
    return {
      ok: false,
      status: 400,
      code: "needs_decision",
      errors: [
        `Switching off "${current.label}" loosens a control. Record a decision: accept the residual or name what compensates, say why, and set a review date.`,
      ],
    };
  }
  if (tightens && input.decision) {
    const permitted = decisionPermitsRetirement(input.decision, asOf);
    if (!permitted.ok) return { ok: false, status: 400, code: "invalid", errors: permitted.errors };
  }

  // The decision first: it validates once more and, refused, nothing else is written.
  let decision: ControlDecision | undefined;
  if (tightens && input.decision) {
    const recorded = await recordDecision(db, {
      tenantId: input.tenantId,
      actor: input.actor,
      subjectKind: "exception",
      subjectId: current.id,
      kind: input.decision.kind,
      note: input.decision.note,
      reviewBy: input.decision.reviewBy,
      now,
    });
    if (!recorded.ok) return { ok: false, status: 400, code: "invalid", errors: recorded.errors };
    decision = recorded.decision;
  }

  const retired: ThresholdException = {
    ...current,
    enabled: false,
    effectiveTo: current.effectiveTo && current.effectiveTo < asOf ? current.effectiveTo : asOf,
  };
  const next = {
    ...active.policy,
    exceptions: (active.policy.exceptions ?? []).map((e) => (e.id === input.exceptionId ? retired : e)),
  };
  await writePolicyVersion(db, {
    tenantId: input.tenantId,
    version: active.version + 1,
    policy: next,
    createdById: input.actor.id,
    createdByName: input.actor.name,
    now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "control.policy_changed",
    {
      version: active.version + 1,
      change: "exception_retired",
      exceptionId: input.exceptionId,
      action: current.action,
      loosens: tightens,
      reason: input.reason?.trim() || null,
      decisionId: decision?.id ?? null,
      reviewBy: decision?.reviewBy ?? null,
    },
    now
  );
  return { ok: true, policyVersion: active.version + 1, exception: retired, decision };
}

/**
 * Switches a retired tightening exception back on, in a new policy version,
 * and retires the decision that licensed switching it off: the control
 * stands again, so nothing is left to accept (Increment 1.31). A retired
 * raise or waiver is not restored; those arrive only through addException
 * with their own residual note and window.
 */
export async function restoreException(
  db: AppDb,
  input: { tenantId: string; actor: Actor; exceptionId: string; reason?: string; now?: Date }
): Promise<ExceptionWriteResult> {
  const now = input.now ?? new Date();
  const asOf = now.toISOString().slice(0, 10);
  await lockTenantPolicy(db, input.tenantId);
  const active: ActivePolicy | null = await loadActivePolicy(db, input.tenantId);
  if (!active) {
    return { ok: false, status: 404, code: "no_policy", errors: ["No control policy is configured for this practice."] };
  }
  const current = (active.policy.exceptions ?? []).find((e) => e.id === input.exceptionId);
  if (!current) {
    return { ok: false, status: 404, code: "not_found", errors: [`No exception with id ${input.exceptionId}.`] };
  }
  if (current.enabled) {
    return { ok: false, status: 409, code: "already_on", errors: [`"${current.label}" is already on.`] };
  }
  if (!exceptionTightens(current)) {
    return {
      ok: false,
      status: 400,
      code: "not_restorable",
      errors: [`A retired raise or waiver is not switched back on; add a new exception with its own residual note and window.`],
    };
  }

  const { effectiveTo: _ended, ...rest } = current;
  const restored: ThresholdException = { ...rest, enabled: true };
  const valid = validateThresholdException(restored, asOf);
  if (!valid.ok) return { ok: false, status: 400, code: "invalid", errors: valid.errors };

  // The switch-off decision ends with the switch-on: one retire row, written by the review path.
  let decision: ControlDecision | undefined;
  const governing = latestDecisionFor(await listDecisions(db, input.tenantId), "exception", current.id);
  if (governing) {
    const ended = await reviewDecision(db, {
      tenantId: input.tenantId,
      actor: input.actor,
      decisionId: governing.id,
      action: "retire",
      note: input.reason?.trim() || `"${current.label}" is switched back on; nothing is left to accept.`,
      now,
    });
    if (!ended.ok) return { ok: false, status: 400, code: "invalid", errors: ended.errors };
    decision = ended.decision;
  }

  const next = {
    ...active.policy,
    exceptions: (active.policy.exceptions ?? []).map((e) => (e.id === input.exceptionId ? restored : e)),
  };
  await writePolicyVersion(db, {
    tenantId: input.tenantId,
    version: active.version + 1,
    policy: next,
    createdById: input.actor.id,
    createdByName: input.actor.name,
    now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "control.policy_changed",
    {
      version: active.version + 1,
      change: "exception_restored",
      exceptionId: input.exceptionId,
      action: current.action,
      reason: input.reason?.trim() || null,
      retiredDecisionId: governing?.id ?? null,
    },
    now
  );
  return { ok: true, policyVersion: active.version + 1, exception: restored, decision };
}
