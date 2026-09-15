import { describe, expect, it } from "vitest";
import { allocatePatientLedger } from "./balances";
import type { LedgerEntry } from "./types";

const base = (overrides: Partial<LedgerEntry>): LedgerEntry => ({
  id: overrides.id ?? "e1",
  tenantId: "t1",
  accountId: "a1",
  patientId: "p1",
  locationId: "l1",
  kind: "charge",
  glBucket: "patient_ar",
  amountCents: 10000,
  currency: "USD",
  effectiveDate: "2026-09-01",
  postedAt: "2026-09-01T12:00:00.000Z",
  createdById: "u1",
  createdByName: "Dana",
  idempotencyKey: "k1",
  ...overrides,
});

describe("allocatePatientLedger", () => {
  it("splits patient due and insurance pending on a covered charge", () => {
    const entries = [
      base({ id: "ch1", kind: "charge", amountCents: 118000, insuranceExpectedCents: 59000 }),
    ];
    const { balances } = allocatePatientLedger("p1", entries);
    expect(balances.patientDueCents).toBe(59000);
    expect(balances.insurancePendingCents).toBe(59000);
    expect(balances.creditCents).toBe(0);
  });

  it("applies a partial patient payment to the oldest charge", () => {
    const entries = [
      base({ id: "ch1", kind: "charge", amountCents: 10000, insuranceExpectedCents: 0 }),
      base({
        id: "pay1",
        kind: "patient_payment",
        amountCents: -4000,
        glBucket: "patient_ar",
        effectiveDate: "2026-09-02",
      }),
    ];
    const { balances } = allocatePatientLedger("p1", entries);
    expect(balances.patientDueCents).toBe(6000);
    expect(balances.creditCents).toBe(0);
  });

  it("leaves unapplied credit when payment exceeds open charges", () => {
    const entries = [
      base({ id: "ch1", kind: "charge", amountCents: 4400, insuranceExpectedCents: 0 }),
      base({
        id: "pay1",
        kind: "patient_payment",
        amountCents: -8800,
        glBucket: "unapplied_credit",
        effectiveDate: "2026-09-02",
      }),
    ];
    const { balances } = allocatePatientLedger("p1", entries);
    expect(balances.patientDueCents).toBe(0);
    expect(balances.creditCents).toBe(4400);
  });
});
