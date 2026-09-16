import { uuidv7 } from "@pms/db";
import { buildIdempotencyKey, isIdempotentDuplicate } from "./idempotency";
import { deriveAllocationsForPayment } from "./balances";
import type {
  LedgerEntry,
  LedgerKind,
  PaymentAllocation,
  PostRefusal,
  PostResult,
  PostSuccess,
} from "./types";

export type PostEntryInput = {
  tenantId: string;
  accountId: string;
  patientId: string;
  locationId: string;
  kind: LedgerKind;
  glBucket: LedgerEntry["glBucket"];
  amountCents: number;
  currency?: string;
  reasonCode?: string | null;
  effectiveDate: string;
  postedAt?: string;
  createdById: string;
  createdByName: string;
  procedureId?: string | null;
  claimId?: string | null;
  coverageId?: string | null;
  reversesEntryId?: string | null;
  approvalRequestId?: string | null;
  appliedExceptionId?: string | null;
  tender?: LedgerEntry["tender"];
  memo?: string | null;
  idempotencyKey?: string;
  insuranceExpectedCents?: number | null;
  chargeIds?: string[];
};

export type PostEntryFn = (input: PostEntryInput) => Promise<PostResult>;

export type LedgerWriter = {
  findByIdempotencyKey(tenantId: string, key: string): Promise<LedgerEntry | null>;
  insertEntry(entry: LedgerEntry): Promise<LedgerEntry>;
  insertAllocations(rows: PaymentAllocation[]): Promise<void>;
  listPatientEntries(patientId: string): Promise<LedgerEntry[]>;
};

function validateSign(kind: LedgerKind, amountCents: number): PostRefusal | null {
  if (kind === "charge" && amountCents <= 0) {
    return {
      ok: false,
      code: "invalid_amount",
      verb: "Enter a positive charge",
      control: "Amount",
      why: "Charges are stored as positive cents.",
    };
  }
  if (
    (kind === "patient_payment" ||
      kind === "insurance_payment" ||
      kind === "write_off" ||
      kind === "adjustment") &&
    amountCents >= 0
  ) {
    return {
      ok: false,
      code: "invalid_amount",
      verb: "Enter a credit amount",
      control: "Amount",
      why: "Payments and write-offs are stored as negative cents.",
    };
  }
  return null;
}

export function makeInMemoryWriter(store: {
  entries: LedgerEntry[];
  allocations: PaymentAllocation[];
}): LedgerWriter {
  return {
    async findByIdempotencyKey(tenantId, key) {
      return (
        store.entries.find((e) => e.tenantId === tenantId && e.idempotencyKey === key) ?? null
      );
    },
    async insertEntry(entry) {
      store.entries.push(entry);
      return entry;
    },
    async insertAllocations(rows) {
      store.allocations.push(...rows);
    },
    async listPatientEntries(patientId) {
      return store.entries.filter((e) => e.patientId === patientId);
    },
  };
}

export function createPostEntry(writer: LedgerWriter): PostEntryFn {
  return async (input) => {
    const signError = validateSign(input.kind, input.amountCents);
    if (signError) return signError;

    const idempotencyKey =
      input.idempotencyKey ??
      buildIdempotencyKey({
        tenantId: input.tenantId,
        kind: input.kind,
        patientId: input.patientId,
        amountCents: input.amountCents,
        effectiveDate: input.effectiveDate,
        procedureId: input.procedureId,
        reversesEntryId: input.reversesEntryId,
      });

    const existing = await writer.findByIdempotencyKey(input.tenantId, idempotencyKey);
    if (existing) {
      return { ok: true, entry: existing, allocations: [], duplicate: true };
    }

    const postedAt = input.postedAt ?? new Date().toISOString();
    const entry: LedgerEntry = {
      id: uuidv7(),
      tenantId: input.tenantId,
      accountId: input.accountId,
      patientId: input.patientId,
      locationId: input.locationId,
      kind: input.kind,
      glBucket: input.glBucket,
      amountCents: input.amountCents,
      currency: input.currency ?? "USD",
      reasonCode: input.reasonCode,
      effectiveDate: input.effectiveDate,
      postedAt,
      createdById: input.createdById,
      createdByName: input.createdByName,
      procedureId: input.procedureId,
      claimId: input.claimId,
      coverageId: input.coverageId,
      reversesEntryId: input.reversesEntryId,
      approvalRequestId: input.approvalRequestId,
      appliedExceptionId: input.appliedExceptionId,
      tender: input.tender,
      memo: input.memo,
      idempotencyKey,
      insuranceExpectedCents: input.insuranceExpectedCents,
      chargeIds: input.chargeIds,
    };

    try {
      await writer.insertEntry(entry);
    } catch (error) {
      if (isIdempotentDuplicate(error)) {
        const dup = await writer.findByIdempotencyKey(input.tenantId, idempotencyKey);
        if (dup) return { ok: true, entry: dup, allocations: [], duplicate: true };
      }
      throw error;
    }

    let allocations: PaymentAllocation[] = [];
    if (
      input.kind === "patient_payment" ||
      input.kind === "insurance_payment" ||
      input.kind === "write_off"
    ) {
      const prior = await writer.listPatientEntries(input.patientId);
      allocations = deriveAllocationsForPayment(entry, prior, input.tenantId, () => uuidv7());
      if (allocations.length) await writer.insertAllocations(allocations);
    }

    return { ok: true, entry, allocations };
  };
}

export type { PostSuccess };
