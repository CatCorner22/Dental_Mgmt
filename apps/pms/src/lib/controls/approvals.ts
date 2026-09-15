import { and, eq, ne, sql } from "drizzle-orm";
import type { ReleaseEvaluation } from "@pms/controls-engine";
import {
  approvalRequests,
  approvalsLog,
  domainEvent,
  GENESIS_HASH,
  hashDomainEvent,
  uuidv7,
} from "@pms/db";
import type { PostEntryInput } from "@pms/ledger";
import type { AppDb } from "../db/client";
import { TENANT_CHAIN_LOCK_SQL } from "../auth/postgresStore";

export type ApprovalRow = {
  id: string;
  tenantId: string;
  status: string;
  channel: string;
  amountCents: number;
  currency: string;
  subjectKind: string;
  subjectId: string | null;
  heldPayload: PostEntryInput;
  evaluation: ReleaseEvaluation;
  requesterId: string;
  requesterName: string;
  secondApproverId: string | null;
  secondApproverName: string | null;
  decisionReason: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  resultingEntryId: string | null;
};

type CreateInput = {
  tenantId: string;
  channel: string;
  amountCents: number;
  heldPayload: PostEntryInput;
  evaluation: ReleaseEvaluation;
  requesterId: string;
  requesterName: string;
  subjectId?: string | null;
  now?: Date;
};

async function appendEvent(
  db: AppDb,
  tenantId: string,
  actorUserId: string,
  kind: string,
  payload: Record<string, unknown>,
  at: Date
) {
  await db.execute(TENANT_CHAIN_LOCK_SQL(tenantId));
  const [last] = await db
    .select({ hash: domainEvent.hash, seq: domainEvent.seq })
    .from(domainEvent)
    .where(eq(domainEvent.tenantId, tenantId))
    .orderBy(sql`${domainEvent.seq} desc`)
    .limit(1);
  const prevHash = last?.hash ?? GENESIS_HASH;
  const seq = (last?.seq ?? 0) + 1;
  const occurredAt = at;
  const hash = hashDomainEvent({
    prevHash,
    tenantId,
    kind,
    payload,
    occurredAt: occurredAt.toISOString(),
  });
  await db.insert(domainEvent).values({
    id: uuidv7(at.getTime()),
    tenantId,
    actorUserId,
    kind,
    payload,
    prevHash,
    hash,
    occurredAt,
    seq,
  });
}

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
    heldPayload: row.heldPayload as PostEntryInput,
    evaluation: row.evaluation as ReleaseEvaluation,
    requesterId: row.requesterId,
    requesterName: row.requesterName,
    secondApproverId: row.secondApproverId,
    secondApproverName: row.secondApproverName,
    decisionReason: row.decisionReason,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    resultingEntryId: row.resultingEntryId,
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
