import type { Queryable } from "./migrate";
import { SEED_BANK, SEED_LEDGER, SEED_STORY_WEEK } from "./seed-data";

/** Demo deposits for Ridgeview day-close walkthrough (matches deposit-slip fixture). */
export async function seedDayCloseDemo(db: Queryable, now: Date): Promise<void> {
  const frontDeskId = "0196b0a0-0000-7000-8000-000000000012";
  const businessDate = SEED_STORY_WEEK.effective;

  const rows = [
    {
      id: "0196b0a0-0000-7000-8000-000000000501",
      method: "Cash",
      amountCents: 25000,
      reference: null,
    },
    {
      id: "0196b0a0-0000-7000-8000-000000000502",
      method: "Check",
      amountCents: 10000,
      reference: "1042",
    },
  ];

  for (const row of rows) {
    await db.query(
      `INSERT INTO deposits (
         id, tenant_id, location_id, bank_account_id, business_date, method,
         amount_cents, reference, status, prepared_by_id, prepared_by_name, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        SEED_BANK.tenantId,
        SEED_LEDGER.locationId,
        SEED_BANK.accountId,
        businessDate,
        row.method,
        row.amountCents,
        row.reference,
        frontDeskId,
        "Finn Front",
        now,
      ]
    );
  }
}
