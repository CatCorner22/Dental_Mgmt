import { and, eq, sql } from "drizzle-orm";
import {
  bankStatementImports,
  bankTransactions,
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
};

type DepositSlipCandidate = {
  stagedRowId: string;
  importRunId: string;
  depositDate: string;
  amountCents: number;
  method: string;
  reference: string | null;
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
    seq,
    occurredAt,
  });
}

async function loadDepositSlipCandidates(db: AppDb, tenantId: string): Promise<DepositSlipCandidate[]> {
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

  const candidates: DepositSlipCandidate[] = [];
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
      stagedRowId: row.stagedRowId,
      importRunId: row.importRunId,
      depositDate: payload.depositDate,
      amountCents: payload.amountCents,
      method: payload.method ?? "",
      reference: payload.reference ?? null,
    });
  }
  return candidates;
}

function findDepositMatch(
  candidates: DepositSlipCandidate[],
  postedDate: string,
  amountCents: number
): DepositSlipCandidate | null {
  if (amountCents <= 0) return null;
  return (
    candidates.find(
      (candidate) =>
        candidate.depositDate === postedDate && candidate.amountCents === amountCents
    ) ?? null
  );
}

export async function createBankStatementImport(
  db: AppDb,
  input: CreateBankStatementImportInput
): Promise<BankStatementImportResult> {
  const now = input.now ?? new Date();
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
    };
  }

  const depositCandidates = await loadDepositSlipCandidates(db, input.tenantId);
  const usedDeposits = new Set<string>();
  let matchedDepositCount = 0;
  let matchedCents = 0;
  let varianceCents = 0;
  const transactionIds: { id: string; staged: (typeof staged)[number]; match: DepositSlipCandidate | null }[] = [];

  for (const row of staged) {
    const txnId = uuidv7(now.getTime() + row.rowNumber);
    await db
      .insert(bankTransactions)
      .values({
        id: txnId,
        tenantId: input.tenantId,
        bankAccountId: input.bankAccountId,
        importId,
        postedDate: row.payload.postedDate,
        description: row.payload.description,
        amountCents: row.payload.amountCents,
        externalKey: row.externalKey,
        payload: row.payload,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [bankTransactions.tenantId, bankTransactions.bankAccountId, bankTransactions.externalKey],
      });

    const match = findDepositMatch(
      depositCandidates.filter((c) => !usedDeposits.has(c.stagedRowId)),
      row.payload.postedDate,
      row.payload.amountCents
    );
    if (match) {
      usedDeposits.add(match.stagedRowId);
      matchedDepositCount += 1;
      matchedCents += Math.abs(row.payload.amountCents);
    } else {
      varianceCents += Math.abs(row.payload.amountCents);
    }
    transactionIds.push({ id: txnId, staged: row, match });
  }

  const periodStart = summary.periodStart ?? staged[0]?.payload.postedDate ?? now.toISOString().slice(0, 10);
  const periodEnd = summary.periodEnd ?? staged.at(-1)?.payload.postedDate ?? periodStart;
  const reconciliationRunId = uuidv7(now.getTime() + 99_999);
  const openVarianceCount = transactionIds.filter((row) => !row.match).length;
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
        kind: row.match ? "matched_deposit" : "unmatched_bank",
        amountCents: row.staged.payload.amountCents,
        description: row.staged.payload.description,
        status: row.match ? "matched" : "open",
        matchRef: row.match
          ? {
              importRunId: row.match.importRunId,
              stagedRowId: row.match.stagedRowId,
              method: row.match.method,
              reference: row.match.reference,
            }
          : null,
        createdAt: now,
      }))
    );
  }

  await appendEvent(db, input.tenantId, input.actorUserId, "import.bank_statement.applied", {
    importId,
    reconciliationRunId,
    bankAccountId: input.bankAccountId,
    rowCount: summary.rowCount,
    reconciliationStatus,
    matchedDepositCount,
    openVarianceCount,
  }, now);

  return {
    importId,
    reconciliationRunId,
    status: "validated",
    summary,
    reconciliationStatus,
    unmatchedCount: openVarianceCount,
    matchedDepositCount,
  };
}
