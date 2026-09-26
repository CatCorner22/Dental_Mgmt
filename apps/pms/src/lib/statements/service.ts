import { and, desc, eq, sql } from "drizzle-orm";
import {
  domainEvent,
  GENESIS_HASH,
  guarantorAccounts,
  hashDomainEvent,
  statements,
  uuidv7,
} from "@pms/db";
import type { AppDb } from "../db/client";
import { TENANT_CHAIN_LOCK_SQL } from "../auth/postgresStore";
import { getLedgerAccountDetail } from "../ledger/queries";
import {
  buildStatementSnapshot,
  issueRefusal,
  type StatementRecord,
  type StatementSnapshot,
  type StatementStatus,
} from "./snapshot";

export { buildStatementSnapshot, issueRefusal, statementTotalsFromDetail } from "./snapshot";
export type { StatementRecord, StatementSnapshot, StatementStatus, StatementTotals } from "./snapshot";

type Actor = {
  tenantId: string;
  actorUserId: string;
  actorName: string;
  now?: Date;
};

function todayIsoDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function mapRow(
  row: typeof statements.$inferSelect,
  displayName: string
): StatementRecord {
  const snapshot = (row.snapshot ?? {}) as StatementSnapshot;
  return {
    id: row.id,
    accountId: row.accountId,
    patientId: row.patientId,
    displayName: snapshot.displayName || displayName,
    asOf: String(row.asOf).slice(0, 10),
    status: row.status as StatementStatus,
    patientDueCents: Number(row.patientDueCents),
    insurancePendingCents: Number(row.insurancePendingCents),
    creditCents: Number(row.creditCents),
    holdReason: row.holdReason,
    snapshot,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    issuedByName: row.issuedByName,
    createdAt: row.createdAt.toISOString(),
  };
}

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
  const hash = hashDomainEvent({
    prevHash,
    tenantId,
    actorUserId,
    kind,
    payload,
    occurredAt: at.toISOString(),
  });
  await db.insert(domainEvent).values({
    id: uuidv7(at.getTime()),
    tenantId,
    actorUserId,
    kind,
    payload,
    prevHash,
    hash,
    seq,
    occurredAt: at,
  });
}

export async function listStatements(
  db: AppDb,
  tenantId: string,
  accountId?: string | null
): Promise<StatementRecord[]> {
  const filters = [eq(statements.tenantId, tenantId)];
  if (accountId) filters.push(eq(statements.accountId, accountId));
  const rows = await db
    .select({
      statement: statements,
      displayName: guarantorAccounts.displayName,
    })
    .from(statements)
    .innerJoin(
      guarantorAccounts,
      and(
        eq(guarantorAccounts.id, statements.accountId),
        eq(guarantorAccounts.tenantId, statements.tenantId)
      )
    )
    .where(and(...filters))
    .orderBy(desc(statements.createdAt));
  return rows.map((row) => mapRow(row.statement, row.displayName));
}

export async function getStatement(
  db: AppDb,
  tenantId: string,
  statementId: string
): Promise<StatementRecord | null> {
  const [row] = await db
    .select({
      statement: statements,
      displayName: guarantorAccounts.displayName,
    })
    .from(statements)
    .innerJoin(
      guarantorAccounts,
      and(
        eq(guarantorAccounts.id, statements.accountId),
        eq(guarantorAccounts.tenantId, statements.tenantId)
      )
    )
    .where(and(eq(statements.tenantId, tenantId), eq(statements.id, statementId)))
    .limit(1);
  if (!row) return null;
  return mapRow(row.statement, row.displayName);
}

export async function createDraftStatement(
  db: AppDb,
  input: Actor & {
    accountId: string;
    asOf?: string;
    patientId?: string | null;
  }
): Promise<StatementRecord | { error: "account_not_found" | "patient_not_on_account" }> {
  const now = input.now ?? new Date();
  const asOf = input.asOf?.trim() || todayIsoDate(now);
  const detail = await getLedgerAccountDetail(db, input.tenantId, input.accountId);
  if (!detail) return { error: "account_not_found" };

  const patientId = input.patientId?.trim() || null;
  if (patientId && !detail.patients.some((patient) => patient.patientId === patientId)) {
    return { error: "patient_not_on_account" };
  }

  const resolvedPatientId =
    patientId ?? (detail.patients.length === 1 ? detail.patients[0].patientId : null);
  const snapshot = buildStatementSnapshot(detail, asOf, resolvedPatientId);
  const id = uuidv7(now.getTime());

  await db.insert(statements).values({
    id,
    tenantId: input.tenantId,
    accountId: input.accountId,
    patientId: resolvedPatientId,
    asOf,
    status: "draft",
    patientDueCents: snapshot.totals.patientDueCents,
    insurancePendingCents: snapshot.totals.insurancePendingCents,
    creditCents: snapshot.totals.creditCents,
    holdReason: null,
    snapshot,
    createdAt: now,
  });

  await appendEvent(
    db,
    input.tenantId,
    input.actorUserId,
    "statement.drafted",
    {
      statementId: id,
      accountId: input.accountId,
      patientId: resolvedPatientId,
      asOf,
      patientDueCents: snapshot.totals.patientDueCents,
      insurancePendingCents: snapshot.totals.insurancePendingCents,
      creditCents: snapshot.totals.creditCents,
    },
    now
  );

  const created = await getStatement(db, input.tenantId, id);
  if (!created) return { error: "account_not_found" };
  return created;
}

export async function issueStatement(
  db: AppDb,
  input: Actor & { statementId: string }
): Promise<
  StatementRecord | { error: "not_found" | "already_issued" | "held" | "void" }
> {
  const now = input.now ?? new Date();
  const existing = await getStatement(db, input.tenantId, input.statementId);
  if (!existing) return { error: "not_found" };

  const [account] = await db
    .select({ statementHold: guarantorAccounts.statementHold })
    .from(guarantorAccounts)
    .where(
      and(
        eq(guarantorAccounts.tenantId, input.tenantId),
        eq(guarantorAccounts.id, existing.accountId)
      )
    )
    .limit(1);

  const refusal = issueRefusal(
    existing.status,
    existing.holdReason,
    account?.statementHold === true
  );
  if (refusal) return { error: refusal };

  await db
    .update(statements)
    .set({
      status: "issued",
      issuedAt: now,
      issuedById: input.actorUserId,
      issuedByName: input.actorName,
    })
    .where(and(eq(statements.tenantId, input.tenantId), eq(statements.id, input.statementId)));

  await appendEvent(
    db,
    input.tenantId,
    input.actorUserId,
    "statement.issued",
    {
      statementId: input.statementId,
      accountId: existing.accountId,
      patientId: existing.patientId,
      asOf: existing.asOf,
      patientDueCents: existing.patientDueCents,
      insurancePendingCents: existing.insurancePendingCents,
      creditCents: existing.creditCents,
    },
    now
  );

  const issued = await getStatement(db, input.tenantId, input.statementId);
  if (!issued) return { error: "not_found" };
  return issued;
}

export async function holdStatement(
  db: AppDb,
  input: Actor & { statementId: string; reason: string }
): Promise<
  StatementRecord | { error: "not_found" | "already_issued" | "void" | "reason_required" }
> {
  const now = input.now ?? new Date();
  const reason = input.reason.trim();
  if (!reason) return { error: "reason_required" };

  const existing = await getStatement(db, input.tenantId, input.statementId);
  if (!existing) return { error: "not_found" };
  if (existing.status === "issued") return { error: "already_issued" };
  if (existing.status === "void") return { error: "void" };

  await db
    .update(statements)
    .set({
      status: "held",
      holdReason: reason,
    })
    .where(and(eq(statements.tenantId, input.tenantId), eq(statements.id, input.statementId)));

  await appendEvent(
    db,
    input.tenantId,
    input.actorUserId,
    "statement.held",
    {
      statementId: input.statementId,
      accountId: existing.accountId,
      reason,
    },
    now
  );

  const held = await getStatement(db, input.tenantId, input.statementId);
  if (!held) return { error: "not_found" };
  return held;
}

export async function voidStatement(
  db: AppDb,
  input: Actor & { statementId: string }
): Promise<StatementRecord | { error: "not_found" | "already_issued" }> {
  const now = input.now ?? new Date();
  const existing = await getStatement(db, input.tenantId, input.statementId);
  if (!existing) return { error: "not_found" };
  if (existing.status === "issued") return { error: "already_issued" };
  if (existing.status === "void") return existing;

  await db
    .update(statements)
    .set({ status: "void" })
    .where(and(eq(statements.tenantId, input.tenantId), eq(statements.id, input.statementId)));

  await appendEvent(
    db,
    input.tenantId,
    input.actorUserId,
    "statement.voided",
    { statementId: input.statementId, accountId: existing.accountId },
    now
  );

  const voided = await getStatement(db, input.tenantId, input.statementId);
  if (!voided) return { error: "not_found" };
  return voided;
}

export function patientIdsFromStatement(row: StatementRecord): string[] {
  const fromSnapshot = row.snapshot.patients?.map((patient) => patient.patientId) ?? [];
  const ids = new Set(fromSnapshot);
  if (row.patientId) ids.add(row.patientId);
  return [...ids];
}
