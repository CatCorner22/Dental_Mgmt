/**
 * Segregation of duties from real grants.
 *
 * The current view over a tenant's entitlement rows is the RoleAssignment[]
 * input to detectSodConflicts. A grant that would create a critical
 * conflict is refused unless the actor records a control decision in the
 * same request. Nothing here scores a person; it scores the combination
 * of duties a grant would create.
 */
import type { PracticeState } from "./practice-state";
import { ENTITLEMENTS, type EntitlementId } from "./sod/conflict-rules";
import {
  detectSodConflicts,
  type DetectedConflict,
  type RoleAssignment,
  type SodDetectionReport,
} from "./sod/detect";
import type { Person } from "./types";

export const ENTITLEMENT_IDS: EntitlementId[] = ENTITLEMENTS.map((e) => e.id);

export function isEntitlementId(value: string): value is EntitlementId {
  return (ENTITLEMENT_IDS as string[]).includes(value);
}

/** One live entitlement row, already joined to its person. */
export interface GrantRow {
  personId: string;
  personName: string;
  /** Precog role label (for example "Office Manager"). */
  role: string;
  entitlement: string;
  /** ISO timestamp or date. */
  effectiveFrom: string;
  /** ISO timestamp or date; null or undefined = open-ended. */
  effectiveTo?: string | null;
}

export interface AssignmentsFromGrants {
  assignments: RoleAssignment[];
  /** Rows whose entitlement is not in the rulebook. They are not scored. */
  unknownEntitlements: { personId: string; entitlement: string }[];
}

const DAY_MS = 86_400_000;

/** A bare date spans its whole UTC day; an ISO timestamp is one instant. */
function instant(value: string, edge: "start" | "end"): number {
  if (value.includes("T")) return Date.parse(value);
  const start = Date.parse(`${value}T00:00:00.000Z`);
  return edge === "start" ? start : start + DAY_MS - 1;
}

/** Live at some instant of the asOf day (or at the asOf instant itself). */
function isActive(row: GrantRow, asOf: string): boolean {
  const asOfStart = instant(asOf, "start");
  const asOfEnd = instant(asOf, "end");
  if (row.effectiveFrom && instant(row.effectiveFrom, "start") > asOfEnd) return false;
  if (row.effectiveTo && instant(row.effectiveTo, "end") <= asOfStart) return false;
  return true;
}

/**
 * Builds assignments from live grants only. People without a grant row
 * still appear (with no entitlements) so the report counts them; view-only
 * access is not a grant and is not inferred.
 */
export function assignmentsFromGrants(
  people: Person[],
  grants: GrantRow[],
  asOf: string,
): AssignmentsFromGrants {
  const byPerson = new Map<string, RoleAssignment>();
  for (const p of people) {
    byPerson.set(p.id, { personId: p.id, personName: p.name, role: p.role, entitlements: [] });
  }
  const unknownEntitlements: AssignmentsFromGrants["unknownEntitlements"] = [];
  for (const row of grants) {
    if (!isActive(row, asOf)) continue;
    if (!isEntitlementId(row.entitlement)) {
      unknownEntitlements.push({ personId: row.personId, entitlement: row.entitlement });
      continue;
    }
    let a = byPerson.get(row.personId);
    if (!a) {
      a = {
        personId: row.personId,
        personName: row.personName,
        role: row.role,
        entitlements: [],
      };
      byPerson.set(row.personId, a);
    }
    if (!a.entitlements.includes(row.entitlement)) a.entitlements.push(row.entitlement);
  }
  return { assignments: Array.from(byPerson.values()), unknownEntitlements };
}

export type GrantSeverity = DetectedConflict["severity"];

const SEVERITY_RANK: Record<GrantSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  family: 1,
};

export interface GrantRequest {
  personId: string;
  personName: string;
  role: string;
  entitlement: string;
}

export interface GrantEvaluation {
  /** The grant may be written without a decision. */
  ok: boolean;
  entitlement: EntitlementId | null;
  alreadyHeld: boolean;
  /** Conflicts the grant would add for this person, highest score first. */
  newConflicts: DetectedConflict[];
  maxSeverity: GrantSeverity | null;
  /** An unmitigated critical conflict: refuse unless a decision is recorded. */
  requiresDecision: boolean;
  refusal?: {
    code: "unknown_entitlement" | "sod_critical_conflict";
    why: string;
    nextSteps: string[];
  };
  /** The full report with the grant applied, for callers that persist findings. */
  reportAfter: SodDetectionReport;
}

function conflictsFor(report: SodDetectionReport, personId: string): DetectedConflict[] {
  return report.conflicts.filter((c) => c.personId === personId);
}

/**
 * Evaluates one prospective grant against the live assignments.
 * `mitigatedRuleIds` should be the scoring set (enabled, non-external
 * channels), not every enabled channel.
 */
export function evaluateGrant(
  state: PracticeState,
  assignments: RoleAssignment[],
  grant: GrantRequest,
  options?: {
    mitigatedRuleIds?: Set<string>;
    residualAcceptedControlIds?: Set<string>;
    compensatingByControlId?: Record<string, string[]>;
  },
): GrantEvaluation {
  const detectOptions = {
    dualReleaseMitigatedRuleIds: options?.mitigatedRuleIds ?? new Set<string>(),
    residualAcceptedControlIds: options?.residualAcceptedControlIds,
    compensatingByControlId: options?.compensatingByControlId,
  };
  const before = detectSodConflicts(state, { ...detectOptions, assignments });

  if (!isEntitlementId(grant.entitlement)) {
    return {
      ok: false,
      entitlement: null,
      alreadyHeld: false,
      newConflicts: [],
      maxSeverity: null,
      requiresDecision: false,
      refusal: {
        code: "unknown_entitlement",
        why: `"${grant.entitlement}" is not an entitlement in the control rulebook.`,
        nextSteps: [`Use one of: ${ENTITLEMENT_IDS.join(", ")}.`],
      },
      reportAfter: before,
    };
  }
  const entitlement: EntitlementId = grant.entitlement;

  const existing = assignments.find((a) => a.personId === grant.personId);
  const alreadyHeld = Boolean(existing?.entitlements.includes(entitlement));
  const nextAssignments: RoleAssignment[] = existing
    ? assignments.map((a) =>
        a.personId === grant.personId
          ? { ...a, entitlements: alreadyHeld ? a.entitlements : [...a.entitlements, entitlement] }
          : a,
      )
    : [
        ...assignments,
        {
          personId: grant.personId,
          personName: grant.personName,
          role: grant.role,
          entitlements: [entitlement],
        },
      ];

  const after = detectSodConflicts(state, { ...detectOptions, assignments: nextAssignments });
  const beforeIds = new Set(conflictsFor(before, grant.personId).map((c) => c.id));
  const newConflicts = conflictsFor(after, grant.personId)
    .filter((c) => !beforeIds.has(c.id))
    .sort((a, b) => b.score - a.score);

  const maxSeverity =
    newConflicts.length === 0
      ? null
      : newConflicts.reduce<GrantSeverity>(
          (m, c) => (SEVERITY_RANK[c.severity] > SEVERITY_RANK[m] ? c.severity : m),
          "family",
        );
  const requiresDecision = newConflicts.some(
    (c) => c.severity === "critical" && !c.dualReleaseMitigated,
  );

  const evaluation: GrantEvaluation = {
    ok: !requiresDecision,
    entitlement,
    alreadyHeld,
    newConflicts,
    maxSeverity,
    requiresDecision,
    reportAfter: after,
  };
  if (requiresDecision) {
    const critical = newConflicts.filter(
      (c) => c.severity === "critical" && !c.dualReleaseMitigated,
    );
    evaluation.refusal = {
      code: "sod_critical_conflict",
      why: `Granting ${entitlement} to ${grant.personName} would create ${critical.length} critical conflict${critical.length === 1 ? "" : "s"}: ${critical.map((c) => c.title).join("; ")}.`,
      nextSteps: [
        "Record a control decision (accept residual or compensate) with a review date in the same request.",
        ...Array.from(new Set(critical.flatMap((c) => c.compensatingControls))).slice(0, 4),
      ],
    };
  }
  return evaluation;
}

