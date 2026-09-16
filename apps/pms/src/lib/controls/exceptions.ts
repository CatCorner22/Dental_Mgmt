import {
  activeExceptionSummary,
  channelCoverage,
  validateThresholdException,
  type ChannelCoverageRow,
  type ThresholdException,
} from "@pms/controls-engine";
import type { AppDb } from "../db/client";
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
  | { ok: true; policyVersion: number; exception: ThresholdException }
  | { ok: false; status: 400 | 404 | 409; code: "invalid" | "no_policy" | "duplicate" | "not_found"; errors: string[] };

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

/** Retires an exception: disabled and ended today, in a new policy version. */
export async function retireException(
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
      reason: input.reason?.trim() || null,
    },
    now
  );
  return { ok: true, policyVersion: active.version + 1, exception: retired };
}
