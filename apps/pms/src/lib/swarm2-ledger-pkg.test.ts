import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_LEDGER } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "./db/client";
import { postLedgerEntry, type PostLedgerInput } from "./ledger/post";
import { addException } from "./controls/exceptions";

/**
 * Swarm 2, lens ledger-pkg: the app callers of @pms/ledger against the live
 * database. Live cases run when PMS_TEST_POSTGRES_URL is set and are
 * mandatory under PMS_TEST_POSTGRES_REQUIRED=1 (liveAdminUrl throws).
 * Verified set (swarm2/verified-ledger-pkg): S2-ledger-pkg-7, -8, -9, -10 and
 * the verifier's adjacent S2-ledger-pkg-v1 (overpayment allocation crash).
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const ALL_DAY = { sun: ["00:00", "23:59"], mon: ["00:00", "23:59"], tue: ["00:00", "23:59"], wed: ["00:00", "23:59"], thu: ["00:00", "23:59"], fri: ["00:00", "23:59"], sat: ["00:00", "23:59"] };

describe.skipIf(!adminUrl)("S2-ledger-pkg (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  const jane = { accountId: SEED_LEDGER.accountDoeId, patientId: SEED_LEDGER.patientJaneId };
  const john = { accountId: SEED_LEDGER.accountSmithId, patientId: SEED_LEDGER.patientJohnId };
  function postAs(user: typeof front, post: PostLedgerInput) {
    return withTenantTransaction(tenantId, user.id, (d) =>
      postLedgerEntry(d, { tenantId, actorId: user.id, actorName: user.displayName, post }), env);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = {
      POSTGRES_URL: await db.loginAs("app_rw"),
      APPEND_ROLE_DSN: await db.loginAs("app_append"),
      BCRYPT_COST: "4",
    };
    // Open the location around the clock so the after-hours hold never enters these cases.
    await db.admin.query("UPDATE locations SET hours = $2::jsonb WHERE id = $1", [SEED_LEDGER.locationId, JSON.stringify(ALL_DAY)]);
    // The front desk becomes an Office Manager (eligible write-off initiator), as detectorsLedger.live.test.ts does.
    await db.admin.query(
      "INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from) VALUES ($1, $2, $3, 'approve_writeoffs', now())",
      [uuidv7(52_001), tenantId, front.id]
    );
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  // Negative control: the same payment with amountCents 5000 posts (ok: true, status: "posted").
  // The posting page sends Math.round(dollars * 100), so "1e298" reaches here as 1e300 and "0.001" as 0;
  // the route guard only checks typeof number && isFinite, so 50.5 reaches here from the API.
  it("S2-ledger-pkg-7: postLedgerEntry refuses fractional, out-of-range and zero cents instead of throwing (22P02 / 'Amount must be non-zero.')", async () => {
    const fractional = await postAs(front, { ...jane, kind: "patient_payment", amountCents: 50.5, effectiveDate: "2026-09-17", tender: "cash" });
    expect(fractional).toMatchObject({ ok: false, status: "refused", code: "invalid_amount" });
    const huge = await postAs(front, { ...jane, kind: "patient_payment", amountCents: 1e300, effectiveDate: "2026-09-17", tender: "cash" });
    expect(huge).toMatchObject({ ok: false, status: "refused", code: "invalid_amount" });
    const zero = await postAs(front, { ...jane, kind: "patient_payment", amountCents: 0, effectiveDate: "2026-09-17", tender: "cash" });
    expect(zero).toMatchObject({ ok: false, status: "refused", code: "invalid_amount" });
    const fine = await postAs(front, { ...jane, kind: "patient_payment", amountCents: 5_000, effectiveDate: "2026-09-17", tender: "cash" });
    expect(fine).toMatchObject({ ok: true, status: "posted" });
  });

  // Negative control: a payment equal to the open balance posts. John Smith: seed charge 8900, nothing applied.
  it("S2-ledger-pkg-v1: a patient payment larger than the open charges (or on a paid-up account) posts as credit instead of dying on allocation_exceeds_charge", async () => {
    const over = await postAs(front, { ...john, kind: "patient_payment", amountCents: 10_000, effectiveDate: "2026-09-13", tender: "cash" });
    expect(over).toMatchObject({ ok: true, status: "posted" });
    const exact = await postAs(front, { ...john, kind: "patient_payment", amountCents: 8_900, effectiveDate: "2026-09-14", tender: "cash" });
    expect(exact).toMatchObject({ ok: true, status: "posted" });
    // The account is now paid up (or in credit); a prepayment must still post.
    const prepay = await postAs(front, { ...john, kind: "patient_payment", amountCents: 500, effectiveDate: "2026-09-15", tender: "card" });
    expect(prepay).toMatchObject({ ok: true, status: "posted" });
    const { rows } = await db.admin.query(
      "SELECT coalesce(sum(amount_cents), 0)::int AS paid FROM ledger_entries WHERE tenant_id = $1 AND patient_id = $2 AND kind = 'patient_payment'",
      [tenantId, john.patientId]
    );
    expect(rows[0]).toEqual({ paid: -19_400 });
    const bounds = await db.admin.query(
      "SELECT pa.charge_entry_id, sum(pa.amount_cents)::int AS allocated, max(c.amount_cents)::int AS charge FROM payment_allocations pa JOIN ledger_entries c ON c.id = pa.charge_entry_id WHERE pa.tenant_id = $1 AND c.patient_id = $2 GROUP BY 1",
      [tenantId, john.patientId]
    );
    for (const b of bounds.rows) expect(b.allocated).toBeLessThanOrEqual(b.charge);
  });

  // Negative control: the same $300 write-off with no exception in the policy is held (needs_second), not posted.
  it("S2-ledger-pkg-8: a write-off licensed by a raise_threshold exception posts, citing the exception, instead of tripping the database dual-release trigger", async () => {
    const raised = await withTenantTransaction(tenantId, owner.id, (d) =>
      addException(d, {
        tenantId,
        actor: { id: owner.id, name: owner.displayName },
        exception: {
          id: "ex-s2-writeoff-raise",
          label: "Owner-approved write-off raise",
          channels: ["writeoff"],
          action: "raise_threshold",
          thresholdUsd: 400,
          enabled: true,
          reason: "Owner out of office this week.",
          residualNote: "Owner reviews every write-off on return.",
          createdAt: "",
        },
      }), env);
    expect(raised).toMatchObject({ ok: true });
    // Give Jane enough open balance ($500) for a $300 write-off to allocate within payment_allocations bounds.
    await db.admin.query(
      `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents, effective_date, posted_at,
                                   created_by_id, created_by_name, procedure_id, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, 'charge', 'patient_ar', 50000, '2026-09-16', now(), $6, 'Finn Front', $7, 's2-charge-jane-writeoff', now())`,
      [uuidv7(52_008), tenantId, jane.accountId, jane.patientId, SEED_LEDGER.locationId, front.id, SEED_LEDGER.procedureJaneId]
    );

    // $300 is over the $150 rule threshold and under the $400 exception: the service releases it singly.
    const posted = await withTenantTransaction(tenantId, front.id, (d) =>
      postLedgerEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        post: { accountId: SEED_LEDGER.accountDoeId, patientId: SEED_LEDGER.patientJaneId, kind: "write_off", amountCents: 30_000, effectiveDate: "2026-09-17", reasonCode: "courtesy" },
      }), env);
    expect(posted).toMatchObject({ ok: true, status: "posted" });
    if (!posted.ok) return;
    const { rows } = await db.admin.query("SELECT applied_exception_id, approval_request_id FROM ledger_entries WHERE id = $1", [posted.entryId]);
    expect(rows[0]).toMatchObject({ applied_exception_id: "ex-s2-writeoff-raise", approval_request_id: null });
  });

  // Negative control: a second $40 payment on a different effective date posts as a new row (duplicate: false).
  it("S2-ledger-pkg-9: a split tender (two same-day $40 payments, cash then card) records two payments, not one 'duplicate'", async () => {
    const cash = await postAs(front, { ...jane, kind: "patient_payment", amountCents: 4_000, effectiveDate: "2026-09-16", tender: "cash" });
    expect(cash).toMatchObject({ ok: true, status: "posted" });
    const card = await postAs(front, { ...jane, kind: "patient_payment", amountCents: 4_000, effectiveDate: "2026-09-16", tender: "card" });
    expect(card).toMatchObject({ ok: true, status: "posted" });
    const { rows } = await db.admin.query(
      "SELECT count(*)::int AS n, coalesce(sum(amount_cents), 0)::int AS total FROM ledger_entries WHERE tenant_id = $1 AND patient_id = $2 AND kind = 'patient_payment' AND effective_date = '2026-09-16'",
      [tenantId, jane.patientId]
    );
    expect(rows[0]).toEqual({ n: 2, total: -8_000 });
    expect((card as { duplicate?: boolean }).duplicate).not.toBe(true);
  });

  // Negative control: reposting while the original is NOT reversed returns the original as duplicate: true.
  it("S2-ledger-pkg-10: reposting a payment after its reversal (the documented reversal + repost correction) creates a new entry instead of returning the reversed one as a duplicate", async () => {
    const first = await postAs(front, { ...jane, kind: "patient_payment", amountCents: 2_500, effectiveDate: "2026-09-15", tender: "cash" });
    expect(first).toMatchObject({ ok: true, status: "posted" });
    if (!first.ok) return;
    // The correction: reverse the payment (wrong tender), then repost it.
    await db.admin.query(
      `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents, effective_date, posted_at,
                                   created_by_id, created_by_name, reverses_entry_id, reason_code, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, 'reversal', 'patient_ar', 2500, '2026-09-15', now(), $6, 'Riley Owner', $7, 'correction', $8, now())`,
      [uuidv7(52_010), tenantId, jane.accountId, jane.patientId, SEED_LEDGER.locationId, owner.id, first.entryId, `s2-rev-${first.entryId}`]
    );
    const repost = await postAs(front, { ...jane, kind: "patient_payment", amountCents: 2_500, effectiveDate: "2026-09-15", tender: "card" });
    expect(repost).toMatchObject({ ok: true, status: "posted" });
    if (!repost.ok) return;
    const { rows } = await db.admin.query(
      "SELECT coalesce(sum(amount_cents), 0)::int AS net FROM ledger_entries WHERE tenant_id = $1 AND patient_id = $2 AND effective_date = '2026-09-15'",
      [tenantId, jane.patientId]
    );
    // Payment, reversal, repost: the patient's $25 stays on the ledger.
    expect(rows[0]).toEqual({ net: -2_500 });
    expect(repost.entryId).not.toBe(first.entryId);
    expect((repost as { duplicate?: boolean }).duplicate).not.toBe(true);
  });
});
