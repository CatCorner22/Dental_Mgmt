import type { Queryable } from "./migrate";
import { SEED_LEDGER } from "./seed-data";

/**
 * Idempotent demo ledger for Ridgeview: dual-coverage-style charge with partial
 * patient payment so the three labeled balance numbers are non-zero in the UI.
 */
export async function seedLedgerDemo(db: Queryable, now: Date = new Date()): Promise<void> {
  const {
    tenantId,
    locationId,
    ownerId,
    patientJaneId,
    patientJohnId,
    accountDoeId,
    accountSmithId,
    procedureJaneId,
    procedureJohnId,
    chargeJaneId,
    chargeJohnId,
    paymentJaneId,
    memberJaneId,
    memberJohnId,
    allocationJaneId,
  } = SEED_LEDGER;

  await db.query(
    `INSERT INTO patients (
       id, tenant_id, mrn, first_name, last_name, date_of_birth, primary_location_id,
       created_by_id, created_by_name, created_at
     ) VALUES
       ($1, $2, 'CH-10042', 'Jane', 'Doe', '1985-03-12', $3, $4, 'Riley Owner', $5),
       ($6, $2, 'CH-10088', 'John', 'Smith', '1972-11-04', $3, $4, 'Riley Owner', $5)
     ON CONFLICT (id) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name`,
    [patientJaneId, tenantId, locationId, ownerId, now, patientJohnId]
  );

  await db.query(
    `INSERT INTO guarantor_accounts (id, tenant_id, display_name, created_by_id, created_by_name, created_at)
     VALUES
       ($1, $2, 'Jane Doe', $3, 'Riley Owner', $4),
       ($5, $2, 'John Smith', $3, 'Riley Owner', $4)
     ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [accountDoeId, tenantId, ownerId, now, accountSmithId]
  );

  await db.query(
    `INSERT INTO account_members (id, tenant_id, account_id, patient_id, effective_from, created_at)
     VALUES
       ($1, $2, $3, $4, '2026-09-01', $5),
       ($6, $2, $7, $8, '2026-09-01', $5)
     ON CONFLICT (id) DO NOTHING`,
    [memberJaneId, tenantId, accountDoeId, patientJaneId, now, memberJohnId, accountSmithId, patientJohnId]
  );

  await db.query(
    `INSERT INTO procedures (id, tenant_id, patient_id, cdt_code, description)
     VALUES
       ($1, $2, $3, 'D2391', 'Composite one surface'),
       ($4, $2, $5, 'D0120', 'Periodic exam')
     ON CONFLICT (id) DO NOTHING`,
    [procedureJaneId, tenantId, patientJaneId, procedureJohnId, patientJohnId]
  );

  await db.query(
    `INSERT INTO reason_codes (tenant_id, code, kind, label) VALUES
       ($1, 'courtesy', 'write_off', 'Courtesy adjustment'),
       ($1, 'correction', 'reversal', 'Correction'),
       ($1, 'contractual_ppo', 'write_off', 'Contractual PPO write-off')
     ON CONFLICT (tenant_id, code) DO NOTHING`,
    [tenantId]
  );

  await db.query(
    `INSERT INTO ledger_entries (
       id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
       effective_date, posted_at, created_by_id, created_by_name, procedure_id,
       insurance_expected_cents, idempotency_key, created_at
     ) VALUES
       ($1, $2, $3, $4, $5, 'charge', 'patient_ar', 24500, '2026-09-14', $6, $7, 'Finn Front',
        $8, 10000, 'seed-charge-jane', $6),
       ($9, $2, $10, $11, $5, 'charge', 'patient_ar', 8900, '2026-09-14', $6, $7, 'Finn Front',
        $12, NULL, 'seed-charge-john', $6),
       ($13, $2, $3, $4, $5, 'patient_payment', 'patient_ar', -10000, '2026-09-14', $6, $7,
        'Finn Front', NULL, NULL, 'seed-pay-jane', $6)
     ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
    [
      chargeJaneId,
      tenantId,
      accountDoeId,
      patientJaneId,
      locationId,
      now,
      ownerId,
      procedureJaneId,
      chargeJohnId,
      accountSmithId,
      patientJohnId,
      procedureJohnId,
      paymentJaneId,
    ]
  );

  await db.query(
    `INSERT INTO payment_allocations (id, tenant_id, payment_entry_id, charge_entry_id, amount_cents, created_at)
     SELECT $1, $2, $3, $4, 10000, $5
     WHERE NOT EXISTS (
       SELECT 1 FROM payment_allocations pa
       WHERE pa.tenant_id = $2
         AND pa.payment_entry_id = $3
         AND pa.charge_entry_id = $4
     )`,
    [allocationJaneId, tenantId, paymentJaneId, chargeJaneId, now]
  );
}
