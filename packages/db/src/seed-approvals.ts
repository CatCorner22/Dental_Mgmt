import type { Queryable } from "./migrate";
import { SEED_APPROVAL, SEED_LEDGER } from "./seed-data";

/** Pending dual-release request for the approvals inbox demo. */
export async function seedApprovalsDemo(db: Queryable, now: Date): Promise<void> {
  const frontDeskId = "0196b0a0-0000-7000-8000-000000000012";
  const heldPayload = {
    tenantId: SEED_LEDGER.tenantId,
    accountId: SEED_LEDGER.accountDoeId,
    patientId: SEED_LEDGER.patientJaneId,
    locationId: SEED_LEDGER.locationId,
    kind: "write_off",
    glBucket: "patient_ar",
    amountCents: -7500,
    reasonCode: "courtesy",
    effectiveDate: "2026-09-14",
    createdById: frontDeskId,
    createdByName: "Finn Front",
    memo: "Courtesy adjustment — demo inbox item",
  };
  const evaluation = {
    verb: "refuse",
    code: "needs_second",
    control: "dual_release",
    eligibleSeconds: [{ id: SEED_LEDGER.ownerId, role: "Owner / Dentist", canSecond: true }],
  };

  await db.query(
    `INSERT INTO approval_requests (
       id, tenant_id, status, channel, amount_cents, currency, subject_kind, subject_id,
       held_payload, evaluation, eligible_second_roles, requester_id, requester_name, requested_at
     ) VALUES ($1, $2, 'pending', 'write_off', 7500, 'USD', 'ledger_post', $3, $4::jsonb, $5::jsonb,
       ARRAY['admin'], $6, 'Finn Front', $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      SEED_APPROVAL.requestId,
      SEED_LEDGER.tenantId,
      SEED_LEDGER.patientJaneId,
      JSON.stringify(heldPayload),
      JSON.stringify(evaluation),
      frontDeskId,
      now,
    ]
  );
}
