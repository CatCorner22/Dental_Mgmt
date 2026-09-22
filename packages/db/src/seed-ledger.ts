import type { Queryable } from "./migrate";
import { SEED_LEDGER } from "./seed-data";

/**
 * Idempotent demo ledger for Ridgeview: dual-coverage-style charge with partial
 * patient payment so the three labeled balance numbers are non-zero in the UI.
 */
/**
 * THE SEED'S STORY WEEK IS A LITERAL, AND IT EXPIRES ON 2026-09-27.
 *
 * These rows carry `effective_date` as a written date while `posted_at` is the
 * moment the seed runs, so the gap between them belongs to the wall clock and
 * not to the fixture. `BACKDATE_DAYS = 7` in
 * `apps/pms/src/lib/controls/detectors.ts`, read by `alerts/hardEvents.ts`,
 * raises a `retroactive_entry` once that gap passes seven days — and the owner
 * board and weekly digest cases assert that ordinary seeded rows raise no such
 * thing. On 2026-09-22 the old week (2026-09-14) went eight days stale and
 * turned `main` red.
 *
 * Increment 1.84 moved it to 2026-09-19, five days rather than the six that
 * would have been possible, for a reason worth recording: the money-desk suite
 * imports its deposits at `daysAgo(2)`, so a week anchored on 2026-09-20 would
 * have collided with them on 2026-09-22 and put four rows on a day close that
 * expects two. Five days clears that collision for every day this week survives.
 *
 * The arithmetic is unforgiving. `today - effective` must stay at or under
 * seven, and an effective date may not run ahead of the clock, so **any written
 * date buys at most seven days**. This one buys five, and fails again on
 * 2026-09-27.
 *
 * Moving it again is a stopgap, chosen deliberately over anchoring these dates
 * to the seed run — which would end the drift for good and move every assertion
 * that quotes them. When this next fails, that is the decision waiting.
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
       ($1, 'contractual_ppo', 'write_off', 'Contractual PPO write-off'),
       -- The reason a correction into a closed month must carry (Increment 1.36's
       -- refusal). Without it the database admits no correction into a closed month
       -- at all, since reason_code is a foreign key into this table.
       ($1, 'prior_period', 'adjustment', 'Prior period correction')
     ON CONFLICT (tenant_id, code) DO NOTHING`,
    [tenantId]
  );

  await db.query(
    `INSERT INTO ledger_entries (
       id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
       effective_date, posted_at, created_by_id, created_by_name, procedure_id,
       insurance_expected_cents, idempotency_key, created_at
     ) VALUES
       ($1, $2, $3, $4, $5, 'charge', 'patient_ar', 24500, '2026-09-19', $6, $7, 'Finn Front',
        $8, 10000, 'seed-charge-jane', $6),
       ($9, $2, $10, $11, $5, 'charge', 'patient_ar', 8900, '2026-09-19', $6, $7, 'Finn Front',
        $12, NULL, 'seed-charge-john', $6),
       ($13, $2, $3, $4, $5, 'patient_payment', 'patient_ar', -10000, '2026-09-19', $6, $7,
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
