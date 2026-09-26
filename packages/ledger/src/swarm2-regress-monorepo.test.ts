import { describe, expect, it } from "vitest";
import { allocatePatientLedger, deriveAllocationsForPayment } from "./balances";
import type { LedgerEntry } from "./types";

/**
 * Swarm 2, regression hunt after swarm2/fix-harness, lens monorepo.
 * The allocator's reversal branch (balances.ts, "back" charge) was rewritten
 * on the fix branch and still un-applies the whole reversed amount from one
 * charge, whatever the original payment took from each charge.
 */

const base = (o: Partial<LedgerEntry> & { id: string }): LedgerEntry => ({
  tenantId: "t1",
  accountId: "a1",
  patientId: "p1",
  locationId: "l1",
  kind: "charge",
  glBucket: "patient_ar",
  amountCents: 10_000,
  currency: "USD",
  effectiveDate: "2026-09-01",
  postedAt: "2026-09-01T12:00:00.000Z",
  createdById: "u1",
  createdByName: "Dana",
  idempotencyKey: `k-${o.id}`,
  ...o,
});

describe("S2-regress-monorepo: ledger allocator", () => {
  // Negative control: un-applying the reversal per charge by each charge's own take of the reversed payment makes this pass.
  it("S2-regress-monorepo-1: reversing a payment that spanned two charges restores each charge by what it took, never beyond its amount", () => {
    const rows = [
      base({ id: "c1", kind: "charge", amountCents: 6_000, effectiveDate: "2026-09-01" }),
      base({ id: "c2", kind: "charge", amountCents: 10_000, effectiveDate: "2026-09-02" }),
      base({ id: "p1", kind: "patient_payment", amountCents: -10_000, effectiveDate: "2026-09-03" }),
      base({ id: "r1", kind: "reversal", amountCents: 10_000, reversesEntryId: "p1", effectiveDate: "2026-09-04", reasonCode: "correction" }),
    ];
    const { charges, balances } = allocatePatientLedger("p1", rows);
    const open = Object.fromEntries(charges.map((c) => [c.row.id, c.open]));
    expect(balances.patientDueCents).toBe(16_000);
    // The payment took 6,000 from c1 and 4,000 from c2; its reversal must give exactly that back.
    expect(open).toEqual({ c1: 6_000, c2: 10_000 });
    for (const c of charges) expect(c.open).toBeLessThanOrEqual(c.row.amountCents);

    // The next payment's persisted allocation rows follow the per-charge state: none may exceed its charge.
    const p2 = base({ id: "p2", kind: "patient_payment", amountCents: -10_000, effectiveDate: "2026-09-05" });
    const allocations = deriveAllocationsForPayment(p2, [...rows, p2], "t1", () => "alloc");
    const byCharge = new Map(rows.filter((e) => e.kind === "charge").map((e) => [e.id, e.amountCents]));
    for (const a of allocations) expect(a.amountCents).toBeLessThanOrEqual(byCharge.get(a.chargeEntryId) ?? 0);
    expect(allocations.map((a) => [a.chargeEntryId, a.amountCents])).toEqual([
      ["c1", 6_000],
      ["c2", 4_000],
    ]);
  });
});
