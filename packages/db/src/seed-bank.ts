import type { Queryable } from "./migrate";
import { SEED_BANK } from "./seed-data";

/** Idempotent Ridgeview operating account for bank reconciliation demos. */
export async function seedBankAccount(db: Queryable, now: Date): Promise<void> {
  await db.query(
    `INSERT INTO bank_accounts (
       id, tenant_id, location_id, display_name, institution_name,
       account_number_last4, currency, active, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, 'USD', true, $7)
     ON CONFLICT (id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       institution_name = EXCLUDED.institution_name,
       account_number_last4 = EXCLUDED.account_number_last4`,
    [
      SEED_BANK.accountId,
      SEED_BANK.tenantId,
      SEED_BANK.locationId,
      "Operating · Main",
      "First Community Bank",
      "4821",
      now,
    ]
  );
}
