import { describe, expect, it } from "vitest";
import { allocatePatientLedger } from "./balances";
import { createPostEntry, makeInMemoryWriter } from "./post";
import type { LedgerEntry, LedgerKind, PaymentAllocation } from "./types";

/** Swarm 2, lens ledger-pkg: the posting kernel and the allocator, in memory. */

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

function freshPost() {
  const store = { entries: [] as LedgerEntry[], allocations: [] as PaymentAllocation[] };
  return { store, post: createPostEntry(makeInMemoryWriter(store)) };
}

const input = (kind: LedgerKind, amountCents: number, extra: Partial<Parameters<ReturnType<typeof createPostEntry>>[0]> = {}) => ({
  tenantId: "t1",
  accountId: "a1",
  patientId: "p1",
  locationId: "l1",
  kind,
  glBucket: "patient_ar" as const,
  amountCents,
  effectiveDate: "2026-09-01",
  createdById: "u1",
  createdByName: "Dana",
  reasonCode: kind === "charge" || kind === "patient_payment" ? null : "correction",
  ...extra,
});

describe("S2-ledger-pkg: posting kernel", () => {
  // Negative control: charge 100 and patient_payment -100 are accepted (ok: true) by the same kernel.
  it("S2-ledger-pkg-1: createPostEntry refuses NaN, Infinity, fractional, unsafe and zero amounts for every kind", async () => {
    const { store, post } = freshPost();
    expect((await post(input("charge", 100))).ok).toBe(true);
    expect((await post(input("patient_payment", -100))).ok).toBe(true);
    const bad: Array<[LedgerKind, number]> = [
      ["charge", Number.NaN],
      ["charge", Number.POSITIVE_INFINITY],
      ["charge", 10.5],
      ["charge", 2 ** 53 + 2],
      ["patient_payment", Number.NaN],
      ["refund", 0],
      ["reversal", 0],
      ["transfer_in", 0],
      ["refund", -5],
    ];
    const accepted: string[] = [];
    for (const [kind, amountCents] of bad) {
      const result = await post(input(kind, amountCents, { idempotencyKey: `bad-${kind}-${amountCents}` }));
      if (result.ok || result.code !== "invalid_amount") accepted.push(`${kind} ${amountCents} -> ${result.ok ? "posted" : result.code}`);
    }
    expect(accepted).toEqual([]);
    expect(store.entries.filter((e) => !Number.isSafeInteger(e.amountCents) || e.amountCents === 0)).toEqual([]);
  });

  // Negative control: one reversal that mirrors an unreversed original (amount -10000 against charge 10000) is accepted.
  it("S2-ledger-pkg-2: createPostEntry enforces 'a reversal mirrors an unreversed original' (ADR-0003) — no second reversal, no mismatched amount, no missing target", async () => {
    const { store, post } = freshPost();
    const charge = await post(input("charge", 10_000));
    expect(charge.ok).toBe(true);
    if (!charge.ok) return;
    const first = await post(input("reversal", -10_000, { reversesEntryId: charge.entry.id }));
    expect(first.ok).toBe(true);

    const second = await post(input("reversal", -10_000, { reversesEntryId: charge.entry.id, idempotencyKey: "rev-2" }));
    const mismatch = await post(input("reversal", -4_000, { reversesEntryId: charge.entry.id, idempotencyKey: "rev-3" }));
    const missing = await post(input("reversal", -1_000, { reversesEntryId: "no-such-entry", idempotencyKey: "rev-4" }));
    expect([second.ok, mismatch.ok, missing.ok]).toEqual([false, false, false]);
    expect(store.entries.filter((e) => e.kind === "reversal")).toHaveLength(1);

    // The allocator reads the double reversal as $100 of patient credit on an account that was never paid.
    const { balances } = allocatePatientLedger("p1", store.entries);
    expect(balances).toEqual({ patientDueCents: 0, insurancePendingCents: 0, creditCents: 0 });
  });

  // Negative control: the same key with the same payload returns the original entry with duplicate: true.
  it("S2-ledger-pkg-3: the same idempotency key with a different payload is refused, not reported as a duplicate of the first posting", async () => {
    const { store, post } = freshPost();
    const first = await post(input("patient_payment", -5_000, { idempotencyKey: "req-1" }));
    expect(first.ok).toBe(true);
    const replay = await post(input("patient_payment", -5_000, { idempotencyKey: "req-1" }));
    expect(replay).toMatchObject({ ok: true, duplicate: true });

    const different = await post(input("patient_payment", -9_000, { idempotencyKey: "req-1" }));
    expect(different.ok).toBe(false);
    if (!different.ok) return;
    expect(store.entries).toHaveLength(1);
  });
});

describe("S2-ledger-pkg: allocator vs the arithmetic sum", () => {
  const sum = (rows: LedgerEntry[]) => rows.reduce((s, e) => s + e.amountCents, 0);
  const net = (b: { patientDueCents: number; insurancePendingCents: number; creditCents: number }) =>
    b.patientDueCents + b.insurancePendingCents - b.creditCents;

  // Negative control: payment -337 then refund 337 nets to all zeros (both sides agree at 0).
  it("S2-ledger-pkg-4: a refund larger than the credit on hand leaves the excess as patient due instead of vanishing", () => {
    const rows = [
      base({ id: "e1", kind: "patient_payment", amountCents: -337, effectiveDate: "2026-09-01" }),
      base({ id: "e2", kind: "refund", amountCents: 482, effectiveDate: "2026-09-03", reasonCode: "overpayment" }),
    ];
    const { balances } = allocatePatientLedger("p1", rows);
    expect(sum(rows)).toBe(145);
    expect(balances).toEqual({ patientDueCents: 145, insurancePendingCents: 0, creditCents: 0 });
  });

  // Negative control: the same reversal dated on or after the payment (2026-09-07) restores the $488 due.
  it("S2-ledger-pkg-5: a reversal whose effective date precedes its original still undoes the original (no phantom credit)", () => {
    const rows = [
      base({ id: "e1", kind: "charge", amountCents: 33_900, effectiveDate: "2026-09-06" }),
      base({ id: "e2", kind: "patient_payment", amountCents: -48_800, effectiveDate: "2026-09-07" }),
      base({ id: "e3", kind: "reversal", amountCents: 48_800, reversesEntryId: "e2", effectiveDate: "2026-09-01", reasonCode: "correction" }),
    ];
    const { balances } = allocatePatientLedger("p1", rows);
    expect(sum(rows)).toBe(33_900);
    expect(balances).toEqual({ patientDueCents: 33_900, insurancePendingCents: 0, creditCents: 0 });
  });

  // Negative control: sequences of charges and negative postings alone (no refund/reversal) satisfy the identity.
  it("S2-ledger-pkg-6: for a seeded generator of postings, due + pending - credit equals the arithmetic sum of the rows", () => {
    let seed = 20_260_917;
    const rnd = (n: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % n;
    };
    const kinds: LedgerKind[] = ["charge", "patient_payment", "insurance_payment", "write_off", "adjustment", "refund", "reversal"];
    const failures: string[] = [];
    for (let run = 0; run < 400; run++) {
      const rows: LedgerEntry[] = [];
      const count = 1 + rnd(7);
      for (let i = 0; i < count; i++) {
        const id = `e${String(i).padStart(2, "0")}`;
        const effectiveDate = `2026-09-0${1 + rnd(9)}`;
        const amt = 1 + rnd(500);
        const kind = kinds[rnd(kinds.length)]!;
        if (kind === "charge") rows.push(base({ id, kind, amountCents: amt, insuranceExpectedCents: rnd(amt + 1), effectiveDate }));
        else if (kind === "refund") rows.push(base({ id, kind, amountCents: amt, effectiveDate, reasonCode: "overpayment" }));
        else if (kind === "reversal") {
          const target = rows.filter((e) => e.kind !== "reversal" && !rows.some((r) => r.reversesEntryId === e.id)).pop();
          if (!target) continue;
          rows.push(base({ id, kind, amountCents: -target.amountCents, reversesEntryId: target.id, effectiveDate, reasonCode: "correction" }));
        } else rows.push(base({ id, kind, amountCents: -amt, effectiveDate, reasonCode: kind === "write_off" ? "contractual_ppo" : "courtesy" }));
      }
      const { balances } = allocatePatientLedger("p1", rows);
      if (net(balances) !== sum(rows)) {
        failures.push(
          `sum=${sum(rows)} balances=${JSON.stringify(balances)} rows=${rows.map((e) => `${e.kind}:${e.amountCents}@${e.effectiveDate}${e.reversesEntryId ? `->${e.reversesEntryId}` : ""}`).join(",")}`
        );
      }
    }
    expect(failures.slice(0, 3)).toEqual([]);
    expect(failures).toHaveLength(0);
  });
});
