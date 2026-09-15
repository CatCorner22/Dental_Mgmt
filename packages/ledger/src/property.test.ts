import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { allocatePatientLedger } from "./balances";
import { createPostEntry, makeInMemoryWriter } from "./post";
import type { LedgerEntry, PaymentAllocation } from "./types";

const tenantId = "t-prop";
const accountId = "a-prop";
const patientId = "p-prop";
const locationId = "l-prop";

function charge(id: string, amount: number, insuranceExpected = 0): LedgerEntry {
  return {
    id,
    tenantId,
    accountId,
    patientId,
    locationId,
    kind: "charge",
    glBucket: "patient_ar",
    amountCents: amount,
    currency: "USD",
    effectiveDate: "2026-09-01",
    postedAt: "2026-09-01T12:00:00.000Z",
    createdById: "u1",
    createdByName: "Poster",
    procedureId: `proc-${id}`,
    idempotencyKey: `charge-${id}`,
    insuranceExpectedCents: insuranceExpected,
  };
}

describe("ledger property tests", () => {
  it("never produces negative labeled balances", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 100, max: 50000 }), { minLength: 1, maxLength: 6 }),
        fc.array(fc.integer({ min: 100, max: 50000 }), { maxLength: 6 }),
        (chargeAmounts, paymentAmounts) => {
          const entries: LedgerEntry[] = chargeAmounts.map((amt, i) =>
            charge(`c${i}`, amt, Math.floor(amt / 2))
          );
          paymentAmounts.forEach((amt, i) => {
            entries.push({
              ...charge(`pay${i}`, amt),
              id: `pay${i}`,
              kind: "patient_payment",
              glBucket: "patient_ar",
              amountCents: -amt,
              procedureId: undefined,
              insuranceExpectedCents: undefined,
              effectiveDate: "2026-09-02",
              idempotencyKey: `pay-${i}`,
            });
          });
          const { balances } = allocatePatientLedger(patientId, entries);
          expect(balances.patientDueCents).toBeGreaterThanOrEqual(0);
          expect(balances.insurancePendingCents).toBeGreaterThanOrEqual(0);
          expect(balances.creditCents).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("idempotent posting returns the same entry", async () => {
    const store = { entries: [] as LedgerEntry[], allocations: [] as PaymentAllocation[] };
    const post = createPostEntry(makeInMemoryWriter(store));
    const input = {
      tenantId,
      accountId,
      patientId,
      locationId,
      kind: "charge" as const,
      glBucket: "patient_ar" as const,
      amountCents: 9500,
      effectiveDate: "2026-09-01",
      createdById: "u1",
      createdByName: "Poster",
      procedureId: "proc-1",
      idempotencyKey: "fixed-key",
    };
    const first = await post(input);
    const second = await post(input);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.duplicate).toBe(true);
      expect(second.entry.id).toBe(first.entry.id);
    }
    expect(store.entries).toHaveLength(1);
  });

  it("reversal zeros the open balance for a lone charge", async () => {
    const store = { entries: [] as LedgerEntry[], allocations: [] as PaymentAllocation[] };
    const post = createPostEntry(makeInMemoryWriter(store));
    const original = await post({
      tenantId,
      accountId,
      patientId,
      locationId,
      kind: "charge",
      glBucket: "patient_ar",
      amountCents: 12000,
      effectiveDate: "2026-09-01",
      createdById: "u1",
      createdByName: "Poster",
      procedureId: "proc-1",
      idempotencyKey: "charge-1",
    });
    expect(original.ok).toBe(true);
    if (!original.ok) return;

    await post({
      tenantId,
      accountId,
      patientId,
      locationId,
      kind: "reversal",
      glBucket: "patient_ar",
      amountCents: -12000,
      reasonCode: "correction",
      effectiveDate: "2026-09-02",
      createdById: "u1",
      createdByName: "Poster",
      reversesEntryId: original.entry.id,
      idempotencyKey: "rev-1",
    });

    const { balances } = allocatePatientLedger(patientId, store.entries);
    expect(balances.patientDueCents).toBe(0);
  });
});
