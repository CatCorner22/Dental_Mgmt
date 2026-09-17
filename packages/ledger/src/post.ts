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

/**
 * Why a posting counted as after hours (Increment 1.30): the location's
 * wall clock at posting, from the server, and the window it fell outside.
 * Carried on a held payload so the inbox can say "posted at 21:30; Main is
 * open 07:00 to 19:00 that day", and so the approval re-evaluates with the
 * same fact the hold was made on.
 */
export type AfterHoursFacts = {
  locationName: string;
  /** Three-letter weekday key, e.g. "tue". */
  weekday: string;
  /** Local calendar date YYYY-MM-DD. */
  date: string;
  /** Local wall clock HH:MM. */
  hhmm: string;
  /** The day's open window, or null when the location is closed that day. */
  window: [string, string] | null;
};

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
  /** Set by the posting service when the posting fell outside the location's hours; null or absent otherwise. */
  afterHours?: AfterHoursFacts | null;
};

export type PostEntryFn = (input: PostEntryInput) => Promise<PostResult>;

export type LedgerWriter = {
  findByIdempotencyKey(tenantId: string, key: string): Promise<LedgerEntry | null>;
  insertEntry(entry: LedgerEntry): Promise<LedgerEntry>;
  insertAllocations(rows: PaymentAllocation[]): Promise<void>;
  listPatientEntries(patientId: string): Promise<LedgerEntry[]>;
};

/**
 * The cents model every posting must fit: a non-zero safe integer, as the
 * ledger_entries.amount_cents bigint CHECK (<> 0) stores it. Anything else is
 * refused before a sign rule or the database ever sees it.
 */
export function validateCents(amountCents: number): PostRefusal | null {
  if (!Number.isSafeInteger(amountCents)) {
    return {
      ok: false,
      code: "invalid_amount",
      verb: "Enter an amount in whole cents",
      control: "Amount",
      why: "Amounts are stored as whole cents within the safe integer range.",
    };
  }
  if (amountCents === 0) {
    return {
      ok: false,
      code: "invalid_amount",
      verb: "Enter a non-zero amount",
      control: "Amount",
      why: "A posting must move money; zero cents posts nothing.",
    };
  }
  return null;
}

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
    const signError = validateCents(input.amountCents) ?? validateSign(input.kind, input.amountCents);
    if (signError) return signError;

    const naturalKey = (supersedes?: string) =>
      buildIdempotencyKey({
        tenantId: input.tenantId,
        kind: input.kind,
        patientId: input.patientId,
        amountCents: input.amountCents,
        effectiveDate: input.effectiveDate,
        procedureId: input.procedureId,
        reversesEntryId: input.reversesEntryId,
        tender: input.tender ?? null,
        supersedes,
      });

    let idempotencyKey = input.idempotencyKey ?? naturalKey();
    let existing = await writer.findByIdempotencyKey(input.tenantId, idempotencyKey);
    if (existing && !input.idempotencyKey) {
      // A natural key names the posting, not the attempt. Once the earlier
      // posting has been reversed, the same posting again is the documented
      // reverse-and-repost correction, not a retry: it chains a fresh key.
      const prior = await writer.listPatientEntries(input.patientId);
      for (let hops = 0; existing && hops < 64; hops++) {
        const reversedId = existing.id;
        if (!prior.some((e) => e.kind === "reversal" && e.reversesEntryId === reversedId)) break;
        idempotencyKey = naturalKey(reversedId);
        existing = await writer.findByIdempotencyKey(input.tenantId, idempotencyKey);
      }
    }
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
