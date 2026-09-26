import { and, eq, sql } from "drizzle-orm";
import {
  bankStatementImports,
  bankTransactions,
  deposits,
  domainEvent,
  GENESIS_HASH,
  hashDomainEvent,
  importRuns,
  importStagedRows,
  reconciliationRuns,
  reconciliationVariances,
  uuidv7,
} from "@pms/db";
import {
  hashContent,
  parseBankStatementCsv,
  stageBankRows,
  summarizeBankRows,
  type BankStatementValidationSummary,
} from "@pms/import";
import type { AppDb } from "../db/client";
import { TENANT_CHAIN_LOCK_SQL } from "../auth/postgresStore";
import { requireTenantBankAccount } from "./accounts";

export type CreateBankStatementImportInput = {
  tenantId: string;
  bankAccountId: string;
  content: string;
  fileName?: string;
  actorUserId: string;
  actorName: string;
  now?: Date;
};

export type BankStatementImportResult = {
  importId: string;
  reconciliationRunId: string;
  status: "validated" | "failed";
  summary: BankStatementValidationSummary;
  reconciliationStatus: "matched" | "variance";
  unmatchedCount: number;
  matchedDepositCount: number;
  /** Bank lines this import added; a statement imported twice adds none the second time. */
  newBankLineCount: number;
};

/**
 * Something the practice says it put in the bank: a deposit it prepared in
 * the product (the day-close path), or a Curve Hero deposit-slip row it
 * staged. A bank credit matches the first candidate with the same date and
 * amount; a candidate matches once across every run.
 */
type DepositCandidate = {
  key: string;
  depositDate: string;
  amountCents: number;
  matchRef: Record<string, unknown>;
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
    actorUserId,
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
    seq,
    occurredAt,
  });
}

/** Candidate keys already matched by an earlier run, so a deposit explains one bank credit only. */
async function loadMatchedCandidateKeys(db: AppDb, tenantId: string): Promise<Set<string>> {
  const rows = await db
    .select({ matchRef: reconciliationVariances.matchRef })
    .from(reconciliationVariances)
    .where(and(eq(reconciliationVariances.tenantId, tenantId), eq(reconciliationVariances.kind, "matched_deposit")));
  const keys = new Set<string>();
  for (const row of rows) {
    const ref = (row.matchRef ?? {}) as { depositId?: string; stagedRowId?: string };
    if (ref.depositId) keys.add(`deposit:${ref.depositId}`);
    if (ref.stagedRowId) keys.add(`slip:${ref.stagedRowId}`);
  }
  return keys;
}

async function loadDepositCandidates(db: AppDb, tenantId: string, bankAccountId: string): Promise<DepositCandidate[]> {
  const candidates: DepositCandidate[] = [];

  // Deposits the practice prepared in the product for this bank account, oldest first.
  const prepared = await db
    .select({
      id: deposits.id,
      businessDate: deposits.businessDate,
      amountCents: deposits.amountCents,
      method: deposits.method,
      reference: deposits.reference,
      preparedByName: deposits.preparedByName,
    })
    .from(deposits)
    .where(and(eq(deposits.tenantId, tenantId), eq(deposits.bankAccountId, bankAccountId)))
    .orderBy(deposits.createdAt);
  for (const row of prepared) {
    candidates.push({
      key: `deposit:${row.id}`,
      depositDate: String(row.businessDate),
      amountCents: Number(row.amountCents),
      matchRef: {
        source: "deposit",
        depositId: row.id,
        method: row.method,
        reference: row.reference,
        preparedByName: row.preparedByName,
      },
    });
  }

  // Curve Hero deposit-slip rows staged for the tenant.
  const rows = await db
    .select({
      stagedRowId: importStagedRows.id,
      importRunId: importStagedRows.runId,
      payload: importStagedRows.payload,
    })
    .from(importStagedRows)
    .innerJoin(importRuns, eq(importRuns.id, importStagedRows.runId))
    .where(
      and(eq(importStagedRows.tenantId, tenantId), eq(importRuns.reportKind, "deposit_slip"))
    );
  for (const row of rows) {
    const payload = row.payload as {
      kind?: string;
      depositDate?: string;
      amountCents?: number;
      method?: string;
      reference?: string | null;
    };
    if (payload.kind !== "deposit_slip" || !payload.depositDate || !payload.amountCents) continue;
    candidates.push({
      key: `slip:${row.stagedRowId}`,
      depositDate: payload.depositDate,
      amountCents: payload.amountCents,
      matchRef: {
        source: "deposit_slip",
        importRunId: row.importRunId,
        stagedRowId: row.stagedRowId,
        method: payload.method ?? "",
        reference: payload.reference ?? null,
      },
    });
  }

  const used = await loadMatchedCandidateKeys(db, tenantId);
  return candidates.filter((c) => !used.has(c.key));
}

function findDepositMatch(
  candidates: DepositCandidate[],
  postedDate: string,
  amountCents: number
): DepositCandidate | null {
  if (amountCents <= 0) return null;
  return (
    candidates.find(
      (candidate) =>
        candidate.depositDate === postedDate && candidate.amountCents === amountCents
    ) ?? null
  );
}

/**
 * Inserts the bank line, or finds the one an earlier import of the same
 * statement already holds: bank_transactions is append-only and unique per
 * (tenant, account, external key), so the second import must point its
 * variance rows at the existing line rather than at an id that was never
 * written.
 */
async function upsertBankTransaction(
  db: AppDb,
  input: {
    id: string;
    tenantId: string;
    bankAccountId: string;
    importId: string;
    row: ReturnType<typeof stageBankRows>[number];
    now: Date;
  }
): Promise<{ id: string; inserted: boolean }> {
  const inserted = await db
    .insert(bankTransactions)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      bankAccountId: input.bankAccountId,
      importId: input.importId,
      postedDate: input.row.payload.postedDate,
      description: input.row.payload.description,
      amountCents: input.row.payload.amountCents,
      externalKey: input.row.externalKey,
      payload: input.row.payload,
      createdAt: input.now,
    })
    .onConflictDoNothing({
      target: [bankTransactions.tenantId, bankTransactions.bankAccountId, bankTransactions.externalKey],
    })
    .returning({ id: bankTransactions.id });
  if (inserted[0]) return { id: inserted[0].id, inserted: true };
  const [existing] = await db
    .select({ id: bankTransactions.id })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.tenantId, input.tenantId),
        eq(bankTransactions.bankAccountId, input.bankAccountId),
        eq(bankTransactions.externalKey, input.row.externalKey)
      )
    )
    .limit(1);
  if (!existing) throw new Error("Bank line neither inserted nor found after conflict.");
  return { id: existing.id, inserted: false };
}

type PriorDisposition = { status: string; kind: string; matchRef: Record<string, unknown> | null };

/**
 * How an already-known bank line was last settled: matched to a deposit, or
 * cleared/waived by a reconciler. A statement that overlaps an earlier import
 * repeats such lines; they keep that disposition instead of reopening.
 */
async function priorDisposition(
  db: AppDb,
  tenantId: string,
  bankTransactionId: string
): Promise<PriorDisposition | null> {
  const [row] = await db
    .select({
      status: reconciliationVariances.status,
      kind: reconciliationVariances.kind,
      matchRef: reconciliationVariances.matchRef,
    })
    .from(reconciliationVariances)
    .where(
      and(
        eq(reconciliationVariances.tenantId, tenantId),
        eq(reconciliationVariances.bankTransactionId, bankTransactionId),
        sql`${reconciliationVariances.status} <> 'open'`
      )
    )
    .orderBy(sql`${reconciliationVariances.createdAt} desc`)
    .limit(1);
  if (!row) return null;
  return { status: row.status, kind: row.kind, matchRef: (row.matchRef ?? null) as Record<string, unknown> | null };
}

export async function createBankStatementImport(
  db: AppDb,
  input: CreateBankStatementImportInput
): Promise<BankStatementImportResult> {
  const now = input.now ?? new Date();
  await requireTenantBankAccount(db, input.tenantId, input.bankAccountId);
  const rows = parseBankStatementCsv(input.content);
  const staged = stageBankRows(rows);
  const summary = summarizeBankRows(staged);
  const importId = uuidv7(now.getTime());
  const fileSha256 = hashContent(input.content);

  await db.insert(bankStatementImports).values({
    id: importId,
    tenantId: input.tenantId,
    bankAccountId: input.bankAccountId,
    format: "csv",
    fileName: input.fileName ?? null,
    fileSha256,
    status: summary.status,
    rowCount: summary.rowCount,
    errorCount: summary.errorCount,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    summary,
    createdAt: now,
    createdById: input.actorUserId,
    createdByName: input.actorName,
    completedAt: now,
  });

  if (summary.status === "failed") {
    await appendEvent(db, input.tenantId, input.actorUserId, "import.bank_statement.failed", {
      importId,
      bankAccountId: input.bankAccountId,
      errorCount: summary.errorCount,
    }, now);
    return {
      importId,
      reconciliationRunId: "",
      status: "failed",
      summary,
      reconciliationStatus: "variance",
      unmatchedCount: summary.errorCount,
      matchedDepositCount: 0,
      newBankLineCount: 0,
    };
  }

  const depositCandidates = await loadDepositCandidates(db, input.tenantId, input.bankAccountId);
  const usedDeposits = new Set<string>();
  let matchedDepositCount = 0;
  let matchedCents = 0;
  let varianceCents = 0;
  let newBankLineCount = 0;
  let carriedCount = 0;
  const transactionIds: {
    id: string;
    staged: (typeof staged)[number];
    match: DepositCandidate | null;
    carried: PriorDisposition | null;
  }[] = [];

  for (const row of staged) {
    const txn = await upsertBankTransaction(db, {
      id: uuidv7(now.getTime() + row.rowNumber),
      tenantId: input.tenantId,
      bankAccountId: input.bankAccountId,
      importId,
      row,
      now,
    });
    if (txn.inserted) newBankLineCount += 1;

    const carried = txn.inserted ? null : await priorDisposition(db, input.tenantId, txn.id);
    if (carried) {
      carriedCount += 1;
      if (carried.status === "matched") matchedCents += Math.abs(row.payload.amountCents);
      transactionIds.push({ id: txn.id, staged: row, match: null, carried });
      continue;
    }

    const match = findDepositMatch(
      depositCandidates.filter((c) => !usedDeposits.has(c.key)),
      row.payload.postedDate,
      row.payload.amountCents
    );
    if (match) {
      usedDeposits.add(match.key);
      matchedDepositCount += 1;
      matchedCents += Math.abs(row.payload.amountCents);
    } else {
      varianceCents += Math.abs(row.payload.amountCents);
    }
    transactionIds.push({ id: txn.id, staged: row, match, carried: null });
  }

  const periodStart = summary.periodStart ?? staged[0]?.payload.postedDate ?? now.toISOString().slice(0, 10);
  const periodEnd = summary.periodEnd ?? staged.at(-1)?.payload.postedDate ?? periodStart;
  const reconciliationRunId = uuidv7(now.getTime() + 99_999);
  const openVarianceCount = transactionIds.filter((row) => !row.match && !row.carried).length;
  const reconciliationStatus = openVarianceCount === 0 ? "matched" : "variance";

  await db.insert(reconciliationRuns).values({
    id: reconciliationRunId,
    tenantId: input.tenantId,
    bankAccountId: input.bankAccountId,
    importId,
    source: "statement_import",
    periodStart,
    periodEnd,
    status: reconciliationStatus,
    bankNetCents: summary.totals.netCents,
    matchedCents,
    varianceCents,
    summary: {
      sourceLabel: "statement import",
      creditCents: summary.totals.creditCents,
      debitCents: summary.totals.debitCents,
      openVarianceCount,
      matchedDepositCount,
      newBankLineCount,
      carriedCount,
    },
    createdAt: now,
    createdById: input.actorUserId,
    createdByName: input.actorName,
  });

  if (transactionIds.length > 0) {
    await db.insert(reconciliationVariances).values(
      transactionIds.map((row) => ({
        id: uuidv7(now.getTime() + row.staged.rowNumber + 100_000),
        tenantId: input.tenantId,
        runId: reconciliationRunId,
        bankTransactionId: row.id,
        kind: row.carried ? row.carried.kind : row.match ? "matched_deposit" : "unmatched_bank",
        amountCents: row.staged.payload.amountCents,
        description: row.staged.payload.description,
        status: row.carried ? row.carried.status : row.match ? "matched" : "open",
        matchRef: row.carried ? row.carried.matchRef : row.match ? row.match.matchRef : null,
        createdAt: now,
      }))
    );
  }

  await appendEvent(db, input.tenantId, input.actorUserId, "import.bank_statement.applied", {
    importId,
    reconciliationRunId,
    bankAccountId: input.bankAccountId,
    rowCount: summary.rowCount,
    newBankLineCount,
    reconciliationStatus,
    matchedDepositCount,
    openVarianceCount,
    carriedCount,
  }, now);

  return {
    importId,
    reconciliationRunId,
    status: "validated",
    summary,
    reconciliationStatus,
    unmatchedCount: openVarianceCount,
    matchedDepositCount,
    newBankLineCount,
  };
}
