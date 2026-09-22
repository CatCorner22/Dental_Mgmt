import type { Queryable } from "./migrate";
import { SEED_LEDGER } from "./seed-data";

/**
 * Issued Jane Doe statement for Ridgeview. Totals match the demo ledger
 * allocator: $45 patient due, $100 insurance pending, $0 credit.
 */
export async function seedStatementsDemo(db: Queryable, now: Date): Promise<void> {
  const snapshot = {
    displayName: "Jane Doe",
    asOf: "2026-09-21",
    patients: [
      {
        patientId: SEED_LEDGER.patientJaneId,
        mrn: "CH-10042",
        firstName: "Jane",
        lastName: "Doe",
        patientDueCents: 4500,
        insurancePendingCents: 10000,
        creditCents: 0,
      },
    ],
    lines: [
      {
        entryId: SEED_LEDGER.chargeJaneId,
        patientId: SEED_LEDGER.patientJaneId,
        kind: "charge",
        amountCents: 24500,
        effectiveDate: "2026-09-19",
        postedAt: now.toISOString(),
        reasonCode: null,
        reasonLabel: null,
        posterName: "Finn Front",
        memo: null,
      },
      {
        entryId: SEED_LEDGER.paymentJaneId,
        patientId: SEED_LEDGER.patientJaneId,
        kind: "patient_payment",
        amountCents: -10000,
        effectiveDate: "2026-09-19",
        postedAt: now.toISOString(),
        reasonCode: null,
        reasonLabel: null,
        posterName: "Finn Front",
        memo: null,
      },
    ],
    totals: {
      patientDueCents: 4500,
      insurancePendingCents: 10000,
      creditCents: 0,
    },
  };

  await db.query(
    `INSERT INTO statements (
       id, tenant_id, account_id, patient_id, as_of, status,
       patient_due_cents, insurance_pending_cents, credit_cents,
       snapshot, issued_at, issued_by_id, issued_by_name, created_at
     ) VALUES (
       $1, $2, $3, $4, '2026-09-21', 'issued',
       4500, 10000, 0, $5::jsonb, $6, $7, 'Riley Owner', $6
     )
     ON CONFLICT (id) DO NOTHING`,
    [
      SEED_LEDGER.statementJaneId,
      SEED_LEDGER.tenantId,
      SEED_LEDGER.accountDoeId,
      SEED_LEDGER.patientJaneId,
      JSON.stringify(snapshot),
      now,
      SEED_LEDGER.ownerId,
    ]
  );
}
