import { and, eq } from "drizzle-orm";
import {
  CONTROL_RULEBOOK_VERSION,
  SCORING_VERSION,
  isDecisionSubjectKind,
  reviewPlan,
  validateDecision,
  type ControlDecision,
  type DecisionKind,
  type DecisionSubjectKind,
  type ReviewAction,
} from "@pms/controls-engine";
import { controlDecisions, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "./events";
import { implicatedUserIds, loadFindingSubject } from "./findingSubjects";

export type DecisionRow = typeof controlDecisions.$inferSelect;

export function mapDecision(row: DecisionRow): ControlDecision {
  return {
    id: row.id,
    subjectKind: row.subjectKind as DecisionSubjectKind,
    subjectId: row.subjectId,
    kind: row.kind as DecisionKind,
    note: row.note,
    reviewBy: row.reviewBy ?? undefined,
    residualAtDecision: row.residualAtDecision ?? undefined,
    decidedById: row.decidedById,
    decidedByName: row.decidedByName,
    decidedAt: row.decidedAt.toISOString(),
    supersedesDecisionId: row.supersedesDecisionId ?? undefined,
  };
}

export async function listDecisions(db: AppDb, tenantId: string): Promise<ControlDecision[]> {
  const rows = await db
    .select()
    .from(controlDecisions)
    .where(eq(controlDecisions.tenantId, tenantId))
    .orderBy(controlDecisions.decidedAt);
  return rows.map(mapDecision);
}

export type RecordDecisionInput = {
  tenantId: string;
  actor: { id: string; name: string };
  subjectKind: string;
  subjectId: string;
  kind: string;
  note: string;
  reviewBy?: string;
  residualAtDecision?: number;
  supersedesDecisionId?: string;
  now?: Date;
  /** Skip the event when the caller appends its own (a grant writes role.granted). */
  appendEvent?: boolean;
  /** Set when a review (keep, tighten, retire) writes the row; recorded on the event. */
  reviewAction?: ReviewAction;
};

export type RecordDecisionResult =
  | { ok: true; decision: ControlDecision }
  /**
   * `status` 403 marks a refusal of the actor (self-licensing), 404 a subject
   * or decision that does not exist, 409 a decision already superseded;
   * malformed input carries none and answers 400.
   */
  | { ok: false; errors: string[]; status?: 403 | 404 | 409 };

/**
 * Writes one append-only decision row stamped with both versions and
 * appends control.decision to the chain. Validation happens here so every
 * caller (route, grant, exception) refuses the same malformed input.
 */
export async function recordDecision(db: AppDb, input: RecordDecisionInput): Promise<RecordDecisionResult> {
  const now = input.now ?? new Date();
  const asOf = now.toISOString().slice(0, 10);
  const errors: string[] = [];
  if (!isDecisionSubjectKind(input.subjectKind)) {
    errors.push("Decision subject kind is not recognised.");
  }
  if (!input.subjectId?.trim()) errors.push("Decision needs a subject id.");
  const base = validateDecision({ kind: input.kind, note: input.note, reviewBy: input.reviewBy }, asOf);
  errors.push(...base.errors);
  if (
    input.residualAtDecision != null &&
    (!Number.isInteger(input.residualAtDecision) || input.residualAtDecision < 0 || input.residualAtDecision > 100)
  ) {
    errors.push("residualAtDecision must be a whole number from 0 to 100.");
  }
  // Nobody licenses a conflict on their own duties. The grant path refuses
  // this too; the check lives here so the decisions route shares it.
  const licenses = input.kind === "accept_residual" || input.kind === "compensate";
  const subjectPerson =
    input.subjectKind === "sod_finding" || input.subjectKind === "grant"
      ? input.subjectId.split(":")[0]
      : undefined;
  // A retirement is only ever the end of an existing decision, written by a review.
  if (input.kind === "retire" && !input.supersedesDecisionId) {
    errors.push("A retirement supersedes an existing decision; review that decision instead of recording a retirement on its own.");
  }
  if (errors.length) return { ok: false, errors };
  if (licenses && subjectPerson && subjectPerson === input.actor.id) {
    return {
      ok: false,
      status: 403,
      errors: ["You cannot accept or compensate a conflict on your own duties; a different administrator must record this decision."],
    };
  }

  // A decision on a detector finding governs an open row the detectors
  // wrote, and the same rule holds: the hands the row is about may not
  // license it. Monitor, remediate, and insure stay open to everyone.
  if (input.subjectKind === "detector_finding") {
    const finding = await loadFindingSubject(db, input.tenantId, input.subjectId);
    if (!finding) return { ok: false, errors: ["The finding was not found."] };
    if (finding.status !== "open") {
      return { ok: false, errors: ["The finding is closed. A decision governs an open finding; if it reopens, decide on it then."] };
    }
    if (licenses && (await implicatedUserIds(db, input.tenantId, finding)).includes(input.actor.id)) {
      return {
        ok: false,
        status: 403,
        errors: ["You cannot accept or compensate a finding about your own work; a different administrator must record this decision."],
      };
    }
  }

  if (input.supersedesDecisionId) {
    const prior = await db
      .select({ id: controlDecisions.id })
      .from(controlDecisions)
      .where(eq(controlDecisions.id, input.supersedesDecisionId));
    if (!prior.length) return { ok: false, errors: ["The decision to supersede was not found."] };
  }

  const id = uuidv7(now.getTime());
  await db.insert(controlDecisions).values({
    id,
    tenantId: input.tenantId,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    kind: input.kind,
    note: input.note.trim(),
    reviewBy: input.reviewBy ?? null,
    residualAtDecision: input.residualAtDecision ?? null,
    supersedesDecisionId: input.supersedesDecisionId ?? null,
    decidedById: input.actor.id,
    decidedByName: input.actor.name,
    decidedAt: now,
    scoringVersion: SCORING_VERSION,
    rulebookVersion: CONTROL_RULEBOOK_VERSION,
  });

  if (input.appendEvent !== false) {
    await appendControlEvent(
      db,
      input.tenantId,
      input.actor.id,
      "control.decision",
      {
        decisionId: id,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        kind: input.kind,
        reviewBy: input.reviewBy ?? null,
        supersedesDecisionId: input.supersedesDecisionId ?? null,
        reviewAction: input.reviewAction ?? null,
      },
      now
    );
  }

  const rows = await db.select().from(controlDecisions).where(eq(controlDecisions.id, id));
  return { ok: true, decision: mapDecision(rows[0]!) };
}

export type ReviewDecisionInput = {
  tenantId: string;
  actor: { id: string; name: string };
  decisionId: string;
  action: ReviewAction;
  note?: string;
  now?: Date;
};

/**
 * Reviews a decision that has come due (docs/13 item 21): one superseding
 * row per review, planned by the engine. Keep carries the decision forward
 * 90 days; Tighten replaces it with remediate for 30; Retire ends it. The
 * self-licensing rule applies to a Keep of an accepting decision exactly as
 * it did to the original, so the subject of a conflict cannot keep their
 * own licence alive. Refuses a decision that does not exist (404) or that a
 * later decision already superseded (409): the register moves forward only.
 */
export async function reviewDecision(db: AppDb, input: ReviewDecisionInput): Promise<RecordDecisionResult> {
  const now = input.now ?? new Date();
  const asOf = now.toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(controlDecisions)
    .where(and(eq(controlDecisions.tenantId, input.tenantId), eq(controlDecisions.id, input.decisionId)));
  const prior = rows[0];
  if (!prior) return { ok: false, status: 404, errors: ["The decision was not found."] };
  const later = await db
    .select({ id: controlDecisions.id })
    .from(controlDecisions)
    .where(and(eq(controlDecisions.tenantId, input.tenantId), eq(controlDecisions.supersedesDecisionId, prior.id)));
  if (later.length) {
    return { ok: false, status: 409, errors: ["A later decision already supersedes this one; review that decision instead."] };
  }
  const planned = reviewPlan(mapDecision(prior), input.action, asOf, input.note);
  if (!planned.ok) return { ok: false, errors: planned.errors };
  return recordDecision(db, {
    tenantId: input.tenantId,
    actor: input.actor,
    subjectKind: prior.subjectKind,
    subjectId: prior.subjectId,
    kind: planned.plan.kind,
    note: planned.plan.note,
    reviewBy: planned.plan.reviewBy,
    residualAtDecision: prior.residualAtDecision ?? undefined,
    supersedesDecisionId: planned.plan.supersedesDecisionId,
    reviewAction: input.action,
    now,
  });
}
