import { and, eq, ne } from "drizzle-orm";
import type { ReleaseEvaluation } from "@pms/controls-engine";
import { approvalRequests, approvalsLog, uuidv7 } from "@pms/db";
import type { PostEntryInput } from "@pms/ledger";
import type { AppDb } from "../db/client";
import { appendControlEvent as appendEvent } from "./events";

/**
 * The repost half of a held correction (Increment 1.38). The held payload is
 * the reversal; this rides beside it so the second person's approval writes
 * both halves in one transaction, as Increment 1.37's service does inline.
 */
export type HeldCorrection = {
  correctsEntryId: string;
  repostKind: string;
  repostAmountCents: number;
  repostTender: string | null;
};

/** A held ledger posting, and — for a correction — the repost written with it. */
export type HeldPayload = PostEntryInput & { correction?: HeldCorrection };

export type ApprovalRow = {
  id: string;
  tenantId: string;
  status: string;
  channel: string;
  amountCents: number;
  currency: string;
  subjectKind: string;
  subjectId: string | null;
  heldPayload: HeldPayload;
  evaluation: ReleaseEvaluation;
  requesterId: string;
  requesterName: string;
  secondApproverId: string | null;
  secondApproverName: string | null;
  decisionReason: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  resultingEntryId: string | null;
  /** The entry a correction hold releases the pair for, or null on an ordinary posting. */
  correctsEntryId: string | null;
};

type CreateInput = {
  tenantId: string;
  channel: string;
  amountCents: number;
  heldPayload: HeldPayload;
  evaluation: ReleaseEvaluation;
  requesterId: string;
  requesterName: string;
  subjectId?: string | null;
  /** Set to hold a correction pair: both halves post under this one approval. */
  correctsEntryId?: string | null;
  now?: Date;
};

function mapRow(row: typeof approvalRequests.$inferSelect): ApprovalRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    channel: row.channel,
    amountCents: row.amountCents,
    currency: row.currency,
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
    heldPayload: row.heldPayload as HeldPayload,
    evaluation: row.evaluation as ReleaseEvaluation,
    requesterId: row.requesterId,
    requesterName: row.requesterName,
    secondApproverId: row.secondApproverId,
    secondApproverName: row.secondApproverName,
    decisionReason: row.decisionReason,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    resultingEntryId: row.resultingEntryId,
    correctsEntryId: row.correctsEntryId,
  };
}

export async function createApprovalRequest(
  db: AppDb,
  input: CreateInput
): Promise<ApprovalRow> {
  const now = input.now ?? new Date();
  const id = uuidv7(now.getTime());
  const eligible = input.evaluation.eligibleSeconds?.map((p) => p.role) ?? [];

  await db.insert(approvalRequests).values({
    id,
    tenantId: input.tenantId,
    status: "pending",
    channel: input.channel,
    amountCents: input.amountCents,
    currency: "USD",
    subjectKind: "ledger_post",
    subjectId: input.subjectId ?? input.heldPayload.patientId ?? null,
    heldPayload: input.heldPayload,
    evaluation: input.evaluation,
    eligibleSecondRoles: eligible,
    requesterId: input.requesterId,
    requesterName: input.requesterName,
    correctsEntryId: input.correctsEntryId ?? null,
    requestedAt: now,
  });

  await appendEvent(
    db,
    input.tenantId,
    input.requesterId,
    "approval.requested",
    {
      requestId: id,
      channel: input.channel,
      amountCents: input.amountCents,
    },
    now
  );

  const rows = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id));
  return mapRow(rows[0]!);
}

export async function listInboxApprovals(
  db: AppDb,
  tenantId: string,
  viewerId: string
): Promise<ApprovalRow[]> {
  const rows = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.tenantId, tenantId),
        eq(approvalRequests.status, "pending"),
        ne(approvalRequests.requesterId, viewerId)
      )
    )
    .orderBy(approvalRequests.requestedAt);
  return rows.map(mapRow);
}

export async function getApprovalRequest(
  db: AppDb,
  tenantId: string,
  requestId: string
): Promise<ApprovalRow | null> {
  const rows = await db
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.id, requestId), eq(approvalRequests.tenantId, tenantId)));
  const row = rows[0];
  return row ? mapRow(row) : null;
}

/** Records the entry an approved request produced. Idempotent for the same entry. */
export async function attachResultingEntry(
  db: AppDb,
  input: { tenantId: string; requestId: string; entryId: string }
): Promise<boolean> {
  const updated = await db
    .update(approvalRequests)
    .set({ resultingEntryId: input.entryId })
    .where(
      and(
        eq(approvalRequests.id, input.requestId),
        eq(approvalRequests.tenantId, input.tenantId),
        eq(approvalRequests.status, "approved")
      )
    )
    .returning({ id: approvalRequests.id });
  return updated.length > 0;
}

/**
 * An approved request whose posting the ledger then refused is cancelled,
 * with the refusal as the reason, so an approval never stands without the
 * entry it was for. The approvals log and the chain both record it.
 */
export async function cancelApprovedRequest(
  db: AppDb,
  input: { tenantId: string; requestId: string; actorId: string; actorName: string; reason: string; now?: Date }
): Promise<boolean> {
  const now = input.now ?? new Date();
  const updated = await db
    .update(approvalRequests)
    .set({ status: "cancelled", decisionReason: input.reason.slice(0, 500) })
    .where(
      and(
        eq(approvalRequests.id, input.requestId),
        eq(approvalRequests.tenantId, input.tenantId),
        eq(approvalRequests.status, "approved")
      )
    )
    .returning({ id: approvalRequests.id });
  if (!updated.length) return false;

  await db.insert(approvalsLog).values({
    id: uuidv7(now.getTime()),
    tenantId: input.tenantId,
    requestId: input.requestId,
    decision: "cancelled",
    actorId: input.actorId,
    actorName: input.actorName,
    reason: input.reason.slice(0, 500),
    createdAt: now,
  });
  await appendEvent(
    db,
    input.tenantId,
    input.actorId,
    "approval.cancelled",
    { requestId: input.requestId, reason: input.reason.slice(0, 500) },
    now
  );
  return true;
}

export type DecideResult =
  | { ok: true; request: ApprovalRow }
  | { ok: false; reason: "not_found" | "same_person" | "not_pending" | "decline_reason_required" };

export async function decideApprovalRequest(
  db: AppDb,
  input: {
    tenantId: string;
    requestId: string;
    approverId: string;
    approverName: string;
    decision: "approved" | "declined";
    reason?: string;
    resultingEntryId?: string | null;
    now?: Date;
  }
): Promise<DecideResult> {
  const now = input.now ?? new Date();
  const existing = await getApprovalRequest(db, input.tenantId, input.requestId);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status !== "pending") return { ok: false, reason: "not_pending" };
  if (existing.requesterId === input.approverId) return { ok: false, reason: "same_person" };
  if (input.decision === "declined" && !input.reason?.trim()) {
    return { ok: false, reason: "decline_reason_required" };
  }

  const status = input.decision === "approved" ? "approved" : "declined";
  const updated = await db
    .update(approvalRequests)
    .set({
      status,
      secondApproverId: input.approverId,
      secondApproverName: input.approverName,
      decisionReason: input.reason ?? null,
      decidedAt: now,
      resultingEntryId: input.resultingEntryId ?? null,
    })
    .where(
      and(
        eq(approvalRequests.id, input.requestId),
        eq(approvalRequests.tenantId, input.tenantId),
        eq(approvalRequests.status, "pending")
      )
    )
    .returning();

  if (!updated.length) return { ok: false, reason: "not_pending" };

  await db.insert(approvalsLog).values({
    id: uuidv7(now.getTime()),
    tenantId: input.tenantId,
    requestId: input.requestId,
    decision: input.decision,
    actorId: input.approverId,
    actorName: input.approverName,
    reason: input.reason ?? null,
    createdAt: now,
  });

  await appendEvent(
    db,
    input.tenantId,
    input.approverId,
    input.decision === "approved" ? "approval.decided" : "approval.declined",
    { requestId: input.requestId, decision: input.decision },
    now
  );

  return { ok: true, request: mapRow(updated[0]!) };
}
