import { eq } from "drizzle-orm";
import {
  CONTROL_RULEBOOK_VERSION,
  SCORING_VERSION,
  isDecisionSubjectKind,
  validateDecision,
  type ControlDecision,
  type DecisionKind,
  type DecisionSubjectKind,
} from "@pms/controls-engine";
import { controlDecisions, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "./events";

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
};

export type RecordDecisionResult =
  | { ok: true; decision: ControlDecision }
  | { ok: false; errors: string[] };

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
  if (licenses && subjectPerson && subjectPerson === input.actor.id) {
    errors.push(
      "You cannot accept or compensate a conflict on your own duties; a different administrator must record this decision."
    );
  }
  if (errors.length) return { ok: false, errors };

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
      },
      now
    );
  }

  const rows = await db.select().from(controlDecisions).where(eq(controlDecisions.id, id));
  return { ok: true, decision: mapDecision(rows[0]!) };
}
