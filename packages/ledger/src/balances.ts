import type { AccountBalances, LedgerEntry, PaymentAllocation } from "./types";

type ChargeState = {
  row: LedgerEntry;
  open: number;
  exp: number;
  insPaid: number;
  applied: LedgerEntry[];
  takes: Record<string, number>;
  pending: number;
  due: number;
};

function insurerMoney(entry: LedgerEntry): boolean {
  return (
    entry.kind === "insurance_payment" ||
    (entry.kind === "write_off" && (entry.reasonCode ?? "contractual_ppo") === "contractual_ppo")
  );
}

function pinnedCharges(entry: LedgerEntry, allocations: PaymentAllocation[]): string[] | null {
  if (entry.chargeIds?.length) return entry.chargeIds;
  const fromAlloc = allocations
    .filter((a) => a.paymentEntryId === entry.id)
    .map((a) => a.chargeEntryId);
  return fromAlloc.length ? fromAlloc : null;
}

/**
 * Allocates payments to charges oldest-first and returns the three labeled numbers.
 * Estimates never join; insurance_expected_cents on a charge drives pending insurance.
 */
export function allocatePatientLedger(
  patientId: string,
  entries: LedgerEntry[],
  allocations: PaymentAllocation[] = [],
  asOf?: string
): { charges: ChargeState[]; balances: AccountBalances } {
  const rows = entries
    .filter((e) => e.patientId === patientId && (!asOf || e.effectiveDate <= asOf))
    .slice()
    .sort(
      (a, b) =>
        a.effectiveDate.localeCompare(b.effectiveDate) || a.id.localeCompare(b.id)
    );

  const charges: ChargeState[] = rows
    .filter((e) => e.kind === "charge")
    .map((ch) => ({
      row: ch,
      open: ch.amountCents,
      exp: ch.insuranceExpectedCents ?? 0,
      insPaid: 0,
      applied: [],
      takes: {},
      pending: 0,
      due: 0,
    }));

  const insSide = (c: ChargeState) => Math.max(0, Math.min(c.open, c.exp - c.insPaid));
  const take = (c: ChargeState, e: LedgerEntry, n: number) => {
    c.open -= n;
    c.takes[e.id] = (c.takes[e.id] ?? 0) + n;
    if (!c.applied.includes(e)) c.applied.push(e);
    return n;
  };

  const forIns = (e: LedgerEntry) => {
    const pin = pinnedCharges(e, allocations);
    return charges.filter((c) =>
      pin ? pin.includes(c.row.id) : c.row.effectiveDate <= e.effectiveDate
    );
  };

  let unapplied = 0;

  for (const e of rows) {
    if (e.kind === "charge") continue;
    let rem = -e.amountCents;
    if (e.amountCents > 0) {
      const t = Math.min(unapplied, e.amountCents);
      unapplied -= t;
      const back =
        charges.find((c) => (c.takes[e.reversesEntryId ?? ""] ?? 0) > 0) ??
        charges.slice().reverse().find((c) => c.applied.length);
      const orig = rows.find((x) => x.id === e.reversesEntryId);
      if (back && e.amountCents - t > 0) {
        take(back, e, t - e.amountCents);
        if (orig && insurerMoney(orig)) {
          back.insPaid = Math.max(0, back.insPaid - (e.amountCents - t));
        }
      }
      continue;
    }

    const ins = insurerMoney(e);
    const pool = ins ? forIns(e) : charges;
    for (const c of pool) {
      if (rem <= 0) break;
      const side = ins ? insSide(c) : c.open - insSide(c);
      const n = Math.min(rem, side);
      if (n <= 0) continue;
      rem -= take(c, e, n);
      if (ins) c.insPaid += n;
    }
    for (const c of pool) {
      if (rem <= 0) break;
      if (c.open <= 0) continue;
      rem -= take(c, e, Math.min(rem, c.open));
    }
    if (rem > 0) {
      const last = pool[pool.length - 1];
      if (last) take(last, e, rem);
      else unapplied += rem;
    }
  }

  let patientDue = 0;
  let insurancePending = 0;
  for (const c of charges) {
    if (c.open <= 0) continue;
    c.pending = insSide(c);
    c.due = c.open - c.pending;
    insurancePending += c.pending;
    patientDue += c.due;
  }

  let credit = unapplied;
  const over = charges.reduce((s, c) => s + Math.min(0, c.open), 0);
  if (over < 0) credit += -over;

  return {
    charges,
    balances: {
      patientDueCents: Math.max(0, patientDue),
      insurancePendingCents: Math.max(0, insurancePending),
      creditCents: Math.max(0, credit),
    },
  };
}

/** Derives allocation rows from the in-memory allocator for a payment entry. */
export function deriveAllocationsForPayment(
  payment: LedgerEntry,
  entries: LedgerEntry[],
  tenantId: string,
  idFactory: () => string
): PaymentAllocation[] {
  const { charges } = allocatePatientLedger(payment.patientId, entries);
  const out: PaymentAllocation[] = [];
  for (const c of charges) {
    const amount = c.takes[payment.id];
    if (amount > 0) {
      out.push({
        id: idFactory(),
        tenantId,
        paymentEntryId: payment.id,
        chargeEntryId: c.row.id,
        amountCents: amount,
      });
    }
  }
  return out;
}
