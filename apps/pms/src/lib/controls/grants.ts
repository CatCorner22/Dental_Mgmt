import { and, eq, isNull } from "drizzle-orm";
import {
  decisionPermitsGrant,
  evaluateGrant,
  isEntitlementId,
  ENTITLEMENT_IDS,
  type DecisionInput,
  type DetectedConflict,
  type GrantEvaluation,
} from "@pms/controls-engine";
import { userEntitlements, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { listDecisions, recordDecision } from "./decisions";
import { appendControlEvent } from "./events";
import { refreshSodFindings, type FindingsRefreshSummary } from "./findings";
import { loadControlsContext } from "./practiceState";
import { precogRole } from "./people";

export type GrantInput = {
  tenantId: string;
  actor: { id: string; name: string };
  targetUserId: string;
  entitlement: string;
  reason?: string;
  /** Required when the grant would create an unmitigated critical conflict. */
  decision?: DecisionInput;
  now?: Date;
};

export type GrantRefusalCode =
  | "unknown_entitlement"
  | "target_not_found"
  | "target_inactive"
  | "already_granted"
  | "sod_critical_conflict"
  | "self_grant_requires_second_admin"
  | "decision_invalid";

export type GrantResult =
  | {
      ok: true;
      grantId: string;
      decisionIds: string[];
      evaluation: Pick<GrantEvaluation, "newConflicts" | "maxSeverity" | "requiresDecision">;
      findings: FindingsRefreshSummary;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      code: GrantRefusalCode;
      why: string;
      nextSteps: string[];
      conflicts?: DetectedConflict[];
    };

/**
 * Grants one entitlement. Refuses, in the same transaction, a grant that
 * would create an unmitigated critical SoD conflict unless the actor
 * records a control decision with a review date; the actor may not license
 * their own conflict. Every path that writes also appends role.granted and
 * refreshes the findings table so the SoD view is current on return.
 */
export async function grantEntitlement(db: AppDb, input: GrantInput): Promise<GrantResult> {
  const now = input.now ?? new Date();
  if (!isEntitlementId(input.entitlement)) {
    return {
      ok: false,
      status: 400,
      code: "unknown_entitlement",
      why: `"${input.entitlement}" is not an entitlement in the control rulebook.`,
      nextSteps: [`Use one of: ${ENTITLEMENT_IDS.join(", ")}.`],
    };
  }

  const ctx = await loadControlsContext(db, input.tenantId, now);
  const target = ctx.staff.rows.find((r) => r.id === input.targetUserId);
  if (!target) {
    return {
      ok: false,
      status: 404,
      code: "target_not_found",
      why: "That staff member is not in this practice.",
      nextSteps: ["Pick a staff member from the practice list."],
    };
  }
  if (!target.active) {
    return {
      ok: false,
      status: 409,
      code: "target_inactive",
      why: `${target.displayName} is deactivated; a deactivated account cannot receive grants.`,
      nextSteps: ["Reactivate the account first, or leave it without grants."],
    };
  }

  const evaluation = evaluateGrant(
    ctx.built.state,
    ctx.built.assignments,
    {
      personId: target.id,
      personName: target.displayName,
      role: precogRole(target),
      entitlement: input.entitlement,
    },
    {
      mitigatedRuleIds: ctx.built.detectOptions.dualReleaseMitigatedRuleIds,
      residualAcceptedControlIds: ctx.built.detectOptions.residualAcceptedControlIds,
      compensatingByControlId: ctx.built.detectOptions.compensatingByControlId,
    }
  );

  if (evaluation.alreadyHeld) {
    return {
      ok: false,
      status: 409,
      code: "already_granted",
      why: `${target.displayName} already holds ${input.entitlement}.`,
      nextSteps: ["Nothing to do."],
    };
  }

  const decisionIds: string[] = [];
  if (evaluation.requiresDecision) {
    const critical = evaluation.newConflicts.filter((c) => c.severity === "critical" && !c.dualReleaseMitigated);
    if (!input.decision) {
      return {
        ok: false,
        status: 403,
        code: "sod_critical_conflict",
        why: evaluation.refusal?.why ?? "This grant would create a critical segregation-of-duties conflict.",
        nextSteps: evaluation.refusal?.nextSteps ?? [],
        conflicts: critical,
      };
    }
    if (input.actor.id === input.targetUserId) {
      return {
        ok: false,
        status: 403,
        code: "self_grant_requires_second_admin",
        why: "You cannot record the control decision for a critical conflict on your own grant.",
        nextSteps: ["Ask a different administrator to grant this entitlement and record the decision."],
        conflicts: critical,
      };
    }
    const permitted = decisionPermitsGrant(input.decision, ctx.asOf);
    if (!permitted.ok) {
      return {
        ok: false,
        status: 400,
        code: "decision_invalid",
        why: "The control decision does not license this grant.",
        nextSteps: permitted.errors,
        conflicts: critical,
      };
    }
    for (const conflict of critical) {
      const written = await recordDecision(db, {
        tenantId: input.tenantId,
        actor: input.actor,
        subjectKind: "sod_finding",
        subjectId: conflict.id,
        kind: input.decision.kind,
        note: input.decision.note,
        reviewBy: input.decision.reviewBy,
        residualAtDecision: conflict.score,
        now,
        appendEvent: false,
      });
      if (!written.ok) {
        return {
          ok: false,
          status: 400,
          code: "decision_invalid",
          why: "The control decision could not be recorded.",
          nextSteps: written.errors,
          conflicts: critical,
        };
      }
      decisionIds.push(written.decision.id);
    }
  }

  const grantId = uuidv7(now.getTime());
  await db.insert(userEntitlements).values({
    id: grantId,
    tenantId: input.tenantId,
    userId: target.id,
    entitlement: input.entitlement,
    grantedBy: input.actor.id,
    effectiveFrom: now,
    effectiveTo: null,
    reason: input.reason?.trim() || null,
    decisionId: decisionIds[0] ?? null,
  });

  const decisionsNow = decisionIds.length ? await listDecisions(db, input.tenantId) : ctx.decisions;
  const findings = await refreshSodFindings(db, input.tenantId, evaluation.reportAfter, now, decisionsNow);

  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "role.granted",
    {
      grantId,
      userId: target.id,
      entitlement: input.entitlement,
      newConflicts: evaluation.newConflicts.map((c) => ({ id: c.id, severity: c.severity, score: c.score })),
      decisionIds,
    },
    now
  );

  return {
    ok: true,
    grantId,
    decisionIds,
    evaluation: {
      newConflicts: evaluation.newConflicts,
      maxSeverity: evaluation.maxSeverity,
      requiresDecision: evaluation.requiresDecision,
    },
    findings,
  };
}

export type RevokeInput = {
  tenantId: string;
  actor: { id: string; name: string };
  targetUserId: string;
  entitlement: string;
  reason?: string;
  now?: Date;
};

export type RevokeResult =
  | { ok: true; revokedGrantIds: string[]; findings: FindingsRefreshSummary }
  | { ok: false; status: 404; code: "grant_not_found"; why: string; nextSteps: string[] };

/** Ends every live row for the pair; rows are never deleted. */
export async function revokeEntitlement(db: AppDb, input: RevokeInput): Promise<RevokeResult> {
  const now = input.now ?? new Date();
  const live = await db
    .select({ id: userEntitlements.id })
    .from(userEntitlements)
    .where(
      and(
        eq(userEntitlements.tenantId, input.tenantId),
        eq(userEntitlements.userId, input.targetUserId),
        eq(userEntitlements.entitlement, input.entitlement),
        isNull(userEntitlements.effectiveTo)
      )
    );
  if (!live.length) {
    return {
      ok: false,
      status: 404,
      code: "grant_not_found",
      why: "No live grant matches that staff member and entitlement.",
      nextSteps: ["Check the SoD view for the current grants."],
    };
  }
  for (const row of live) {
    await db
      .update(userEntitlements)
      .set({ effectiveTo: now })
      .where(and(eq(userEntitlements.id, row.id), eq(userEntitlements.tenantId, input.tenantId)));
  }

  const ctx = await loadControlsContext(db, input.tenantId, now);
  const findings = await refreshSodFindings(db, input.tenantId, ctx.built.sod, now, ctx.decisions);

  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "role.revoked",
    {
      grantIds: live.map((r) => r.id),
      userId: input.targetUserId,
      entitlement: input.entitlement,
      reason: input.reason?.trim() || null,
    },
    now
  );
  return { ok: true, revokedGrantIds: live.map((r) => r.id), findings };
}
