import { and, eq } from "drizzle-orm";
import { ledgerEntries, paymentAllocations } from "@pms/db";
import type { LedgerEntry, LedgerWriter, PaymentAllocation } from "@pms/ledger";
import type { AppDb } from "../db/client";

function rowToEntry(row: typeof ledgerEntries.$inferSelect): LedgerEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    accountId: row.accountId,
    patientId: row.patientId,
    locationId: row.locationId,
    kind: row.kind as LedgerEntry["kind"],
    glBucket: row.glBucket as LedgerEntry["glBucket"],
    amountCents: Number(row.amountCents),
    currency: row.currency,
    reasonCode: row.reasonCode,
    effectiveDate: String(row.effectiveDate),
    postedAt: row.postedAt.toISOString(),
    createdById: row.createdById,
    createdByName: row.createdByName,
    procedureId: row.procedureId,
    claimId: row.claimId,
    coverageId: row.coverageId,
    reversesEntryId: row.reversesEntryId,
    approvalRequestId: row.approvalRequestId,
    appliedExceptionId: row.appliedExceptionId,
    tender: row.tender as LedgerEntry["tender"],
    memo: row.memo,
    idempotencyKey: row.idempotencyKey,
    insuranceExpectedCents:
      row.insuranceExpectedCents === null ? null : Number(row.insuranceExpectedCents),
    chargeIds: undefined,
  };
}

export function makePostgresLedgerWriter(db: AppDb): LedgerWriter {
  return {
    async findByIdempotencyKey(tenantId, key) {
      const [row] = await db
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.tenantId, tenantId), eq(ledgerEntries.idempotencyKey, key)))
        .limit(1);
      return row ? rowToEntry(row) : null;
    },
    async insertEntry(entry) {
      const postedAt = new Date(entry.postedAt);
      await db.insert(ledgerEntries).values({
        id: entry.id,
        tenantId: entry.tenantId,
        accountId: entry.accountId,
        patientId: entry.patientId,
        locationId: entry.locationId,
        kind: entry.kind,
        glBucket: entry.glBucket,
        amountCents: entry.amountCents,
        currency: entry.currency,
        reasonCode: entry.reasonCode ?? null,
        effectiveDate: entry.effectiveDate,
        postedAt,
        createdById: entry.createdById,
        createdByName: entry.createdByName,
        procedureId: entry.procedureId ?? null,
        claimId: entry.claimId ?? null,
        coverageId: entry.coverageId ?? null,
        reversesEntryId: entry.reversesEntryId ?? null,
        approvalRequestId: entry.approvalRequestId ?? null,
        appliedExceptionId: entry.appliedExceptionId ?? null,
        tender: entry.tender ?? null,
        memo: entry.memo ?? null,
        idempotencyKey: entry.idempotencyKey,
        insuranceExpectedCents: entry.insuranceExpectedCents ?? null,
        createdAt: postedAt,
      });
      return entry;
    },
    async insertAllocations(rows) {
      if (rows.length === 0) return;
      const createdAt = new Date();
      await db.insert(paymentAllocations).values(
        rows.map((row) => ({
          id: row.id,
          tenantId: row.tenantId,
          paymentEntryId: row.paymentEntryId,
          chargeEntryId: row.chargeEntryId,
          amountCents: row.amountCents,
          createdAt,
        }))
      );
    },
    async listPatientEntries(patientId) {
      const rows = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.patientId, patientId))
        .orderBy(ledgerEntries.postedAt);
      return rows.map(rowToEntry);
    },
  };
}

export type { PaymentAllocation };
