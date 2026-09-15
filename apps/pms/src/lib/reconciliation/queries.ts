import { and, eq, sql } from "drizzle-orm";
import {
  bankAccounts,
  bankTransactions,
  reconciliationRuns,
  reconciliationVariances,
} from "@pms/db";
import type { AppDb } from "../db/client";
import type {
  BankAccountOption,
  ReconciliationRunDetail,
  ReconciliationRunSummary,
  ReconciliationVarianceRow,
} from "./types";

function cents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export async function listBankAccounts(db: AppDb, tenantId: string): Promise<BankAccountOption[]> {
  const rows = await db
    .select({
      bankAccountId: bankAccounts.id,
      displayName: bankAccounts.displayName,
      institutionName: bankAccounts.institutionName,
      accountNumberLast4: bankAccounts.accountNumberLast4,
    })
    .from(bankAccounts)
    .where(eq(bankAccounts.tenantId, tenantId))
    .orderBy(bankAccounts.displayName);

  return rows.map((row) => ({
    bankAccountId: row.bankAccountId,
    displayName: row.displayName,
    institutionName: row.institutionName,
    accountNumberLast4: row.accountNumberLast4,
  }));
}

export async function listReconciliationRuns(
  db: AppDb,
  tenantId: string
): Promise<ReconciliationRunSummary[]> {
  const rows = await db
    .select({
      runId: reconciliationRuns.id,
      bankAccountId: reconciliationRuns.bankAccountId,
      bankAccountName: bankAccounts.displayName,
      source: reconciliationRuns.source,
      periodStart: reconciliationRuns.periodStart,
      periodEnd: reconciliationRuns.periodEnd,
      status: reconciliationRuns.status,
      bankNetCents: reconciliationRuns.bankNetCents,
      matchedCents: reconciliationRuns.matchedCents,
      varianceCents: reconciliationRuns.varianceCents,
      summary: reconciliationRuns.summary,
      createdAt: reconciliationRuns.createdAt,
      createdByName: reconciliationRuns.createdByName,
    })
    .from(reconciliationRuns)
    .innerJoin(bankAccounts, eq(bankAccounts.id, reconciliationRuns.bankAccountId))
    .where(eq(reconciliationRuns.tenantId, tenantId))
    .orderBy(sql`${reconciliationRuns.createdAt} desc`);

  return rows.map((row) => {
    const summary = (row.summary ?? {}) as Record<string, unknown>;
    return {
      runId: row.runId,
      bankAccountId: row.bankAccountId,
      bankAccountName: row.bankAccountName,
      source: row.source,
      periodStart: String(row.periodStart),
      periodEnd: String(row.periodEnd),
      status: row.status,
      bankNetCents: cents(row.bankNetCents),
      matchedCents: cents(row.matchedCents),
      varianceCents: cents(row.varianceCents),
      openVarianceCount: Number(summary.openVarianceCount ?? 0),
      createdAt: row.createdAt.toISOString(),
      createdByName: row.createdByName,
    };
  });
}

export async function getReconciliationRun(
  db: AppDb,
  tenantId: string,
  runId: string
): Promise<ReconciliationRunDetail | null> {
  const [run] = await db
    .select({
      runId: reconciliationRuns.id,
      bankAccountId: reconciliationRuns.bankAccountId,
      bankAccountName: bankAccounts.displayName,
      source: reconciliationRuns.source,
      periodStart: reconciliationRuns.periodStart,
      periodEnd: reconciliationRuns.periodEnd,
      status: reconciliationRuns.status,
      bankNetCents: reconciliationRuns.bankNetCents,
      matchedCents: reconciliationRuns.matchedCents,
      varianceCents: reconciliationRuns.varianceCents,
      summary: reconciliationRuns.summary,
      createdAt: reconciliationRuns.createdAt,
      createdByName: reconciliationRuns.createdByName,
    })
    .from(reconciliationRuns)
    .innerJoin(bankAccounts, eq(bankAccounts.id, reconciliationRuns.bankAccountId))
    .where(and(eq(reconciliationRuns.id, runId), eq(reconciliationRuns.tenantId, tenantId)))
    .limit(1);

  if (!run) return null;

  const varianceRows = await db
    .select({
      varianceId: reconciliationVariances.id,
      kind: reconciliationVariances.kind,
      status: reconciliationVariances.status,
      amountCents: reconciliationVariances.amountCents,
      description: reconciliationVariances.description,
      matchRef: reconciliationVariances.matchRef,
      postedDate: bankTransactions.postedDate,
    })
    .from(reconciliationVariances)
    .leftJoin(
      bankTransactions,
      eq(bankTransactions.id, reconciliationVariances.bankTransactionId)
    )
    .where(eq(reconciliationVariances.runId, runId))
    .orderBy(reconciliationVariances.createdAt);

  const summary = (run.summary ?? {}) as Record<string, unknown>;
  const variances: ReconciliationVarianceRow[] = varianceRows.map((row) => ({
    varianceId: row.varianceId,
    kind: row.kind,
    status: row.status,
    amountCents: cents(row.amountCents),
    description: row.description,
    postedDate: row.postedDate ? String(row.postedDate) : null,
    matchRef: (row.matchRef as Record<string, unknown> | null) ?? null,
  }));

  return {
    runId: run.runId,
    bankAccountId: run.bankAccountId,
    bankAccountName: run.bankAccountName,
    source: run.source,
    periodStart: String(run.periodStart),
    periodEnd: String(run.periodEnd),
    status: run.status,
    bankNetCents: cents(run.bankNetCents),
    matchedCents: cents(run.matchedCents),
    varianceCents: cents(run.varianceCents),
    openVarianceCount: Number(summary.openVarianceCount ?? 0),
    createdAt: run.createdAt.toISOString(),
    createdByName: run.createdByName,
    summary,
    variances,
  };
}
