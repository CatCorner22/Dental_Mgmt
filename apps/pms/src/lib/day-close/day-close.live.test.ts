import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { uuidv7 } from "@pms/db";
import { verifyDatabaseChains } from "@pms/verifier";
import { resetDbPoolForTests, withTenantAppendTransaction, withTenantTransaction } from "../db/client";
import { seedControlPolicy } from "../controls/policy";
import { loadControlsContext } from "../controls/practiceState";
import { freezeDayClose, getDayCloseSnapshot } from "./service";

/**
 * The deposit channel enforced at the seal, on live rows as app_rw: the
 * preparer is refused, an ineligible role is refused, a different eligible
 * person seals with the verdict frozen into the close and onto the chain,
 * and a one-person office degrades to owner-only sealing recorded as a
 * finding. Skipped without PMS_TEST_POSTGRES_URL; mandatory under
 * PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(20_000), name: "Ridgeview Family Dental", slug: "ridgeview-dc" };
const solo = { id: uuidv7(20_500), name: "Solo Smiles", slug: "solo-dc" };
const owner = { id: uuidv7(20_001), username: "dc-owner", name: "Riley Owner", role: "admin" };
const om = { id: uuidv7(20_002), username: "dc-om", name: "Maya Chen", role: "user" };
const front = { id: uuidv7(20_003), username: "dc-front", name: "Jordan Blake", role: "user" };
const clerk = { id: uuidv7(20_004), username: "dc-clerk", name: "Casey Clerk", role: "user" };
const soloOwner = { id: uuidv7(20_501), username: "solo-owner", name: "Sam Solo", role: "admin" };

// Precog role labels follow from grants: approve_writeoffs → Office Manager,
// post_payments → Billing Specialist, otherwise Front Desk Lead. Neither
// front-desk person may second a deposit under the default rule.
const seedGrants: [typeof om, string, string][] = [
  [owner, "bank_reconcile", tenant.id],
  [om, "approve_writeoffs", tenant.id],
  [om, "bank_reconcile", tenant.id],
  [front, "prepare_deposit", tenant.id],
  [front, "collect_cash", tenant.id],
  [clerk, "prepare_deposit", tenant.id],
  [soloOwner, "bank_reconcile", solo.id],
  [soloOwner, "prepare_deposit", solo.id],
];

const location = { id: uuidv7(20_010), name: "Main" };
const annex = { id: uuidv7(20_011), name: "Annex" };
const patient = { id: uuidv7(20_030) };
const account = { id: uuidv7(20_031) };
// A day the practice never sealed, used to show what an unstamped row looks like.
const openDate = "2026-09-15";
const soloLocation = { id: uuidv7(20_510), name: "Main" };
const bank = { id: uuidv7(20_020) };
const soloBank = { id: uuidv7(20_520) };
const businessDate = "2026-09-14";

describe.skipIf(!adminUrl)("Day-close seal (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  let verifier: Client;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as: { id: string }, tenantId = tenant.id) {
    return withTenantTransaction(tenantId, as.id, fn, env);
  }

  async function insertDeposit(tenantId: string, locationId: string, bankId: string, preparer: { id: string; name: string }, amountCents: number, seq: number) {
    await db.admin.query(
      `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                             reference, status, prepared_by_id, prepared_by_name, created_at)
       VALUES ($1, $2, $3, $4, $5, 'cash', $6, $7, 'open', $8, $9, now())`,
      [uuidv7(20_100 + seq), tenantId, locationId, bankId, businessDate, amountCents, `bag-${seq}`, preparer.id, preparer.name]
    );
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    env = {
      POSTGRES_URL: await db.loginAs("app_rw"),
      APPEND_ROLE_DSN: await db.loginAs("app_append"),
      BCRYPT_COST: "4",
    };
    verifier = new Client({ connectionString: await db.loginAs("app_verify") });
    await verifier.connect();

    for (const t of [tenant, solo]) {
      await db.admin.query("INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())", [t.id, t.name, t.slug]);
    }
    const users = [
      [tenant.id, owner],
      [tenant.id, om],
      [tenant.id, front],
      [tenant.id, clerk],
      [solo.id, soloOwner],
    ] as const;
    for (const [tenantId, u] of users) {
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, clinical_role,
                            mfa_enrolled_at, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, 'x', $5, 'unset', now(), now(), now() - interval '2 years')`,
        [u.id, tenantId, u.username, u.name, u.role]
      );
    }
    for (const [u, entitlement, tenantId] of seedGrants) {
      await db.admin.query(
        `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
         VALUES ($1, $2, $3, $4, now())`,
        [uuidv7(), tenantId, u.id, entitlement]
      );
    }
    for (const [t, loc, b] of [
      [tenant, location, bank],
      [solo, soloLocation, soloBank],
    ] as const) {
      await db.admin.query(
        "INSERT INTO locations (id, tenant_id, name, timezone, active, created_at) VALUES ($1, $2, $3, 'America/Chicago', true, now())",
        [loc.id, t.id, loc.name]
      );
      await db.admin.query(
        "INSERT INTO bank_accounts (id, tenant_id, location_id, display_name, created_at) VALUES ($1, $2, $3, 'Operating', now())",
        [b.id, t.id, loc.id]
      );
    }
    await tx((d) => seedControlPolicy(d, { tenantId: tenant.id, createdById: owner.id, createdByName: owner.name }), owner);
    await tx((d) => seedControlPolicy(d, { tenantId: solo.id, createdById: soloOwner.id, createdByName: soloOwner.name }), soloOwner, solo.id);

    // Front desk prepared today's bag; two slips, $350 in total, above the $0 default threshold.
    await insertDeposit(tenant.id, location.id, bank.id, front, 25_000, 1);
    await insertDeposit(tenant.id, location.id, bank.id, front, 10_000, 2);
    // The solo owner prepared their own bag.
    await insertDeposit(solo.id, soloLocation.id, soloBank.id, soloOwner, 18_000, 3);
  }, 60_000);

  afterAll(async () => {
    await verifier?.end();
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("counts the deposit channel as enforced in the practice state", async () => {
    const ctx = await tx((d) => loadControlsContext(d, tenant.id), owner);
    expect(ctx.built.coverage.find((c) => c.channel === "deposit")?.status).toBe("enforced");
    expect(ctx.built.state.staff.dualControlPayments).toBe(true);
  });

  it("refuses the preparer sealing their own bag and names who could count instead", async () => {
    const result = await tx(
      (d) => freezeDayClose(d, { tenantId: tenant.id, locationId: location.id, businessDate, actorUserId: front.id, actorName: front.name }),
      front
    );
    expect(result).toMatchObject({ error: "sod_preparer" });
    if (!("error" in result)) return;
    expect(result.why).toMatch(/cannot seal it/);
    expect(result.otherEligibleNames).toEqual(expect.arrayContaining([om.name, owner.name]));
    expect(result.otherEligibleNames).not.toContain(front.name);

    const closes = await db.admin.query("SELECT 1 FROM day_closes WHERE tenant_id = $1", [tenant.id]);
    expect(closes.rows).toEqual([]);
    const still = await db.admin.query("SELECT status FROM deposits WHERE tenant_id = $1", [tenant.id]);
    expect(still.rows.map((r) => r.status)).toEqual(["open", "open"]);
  });

  it("refuses a role the rule does not let second, even one who did not prepare", async () => {
    const result = await tx(
      (d) => freezeDayClose(d, { tenantId: tenant.id, locationId: location.id, businessDate, actorUserId: clerk.id, actorName: clerk.name }),
      clerk
    );
    expect(result).toMatchObject({ error: "sod_role" });
    if (!("error" in result)) return;
    expect(result.why).toMatch(/may not second a deposit/);
  });

  it("lets a different, eligible person seal, and freezes the verdict into the close and the chain", async () => {
    const result = await tx(
      (d) => freezeDayClose(d, { tenantId: tenant.id, locationId: location.id, businessDate, actorUserId: om.id, actorName: om.name }),
      om
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result).toMatchObject({
      status: "frozen",
      depositTotalCents: 35_000,
      frozenByName: om.name,
      sealStatus: "approved_dual",
      degradedOwnerSeal: false,
    });

    const close = await db.admin.query("SELECT summary, frozen_by_id FROM day_closes WHERE tenant_id = $1", [tenant.id]);
    expect(close.rows).toHaveLength(1);
    expect(close.rows[0].frozen_by_id).toBe(om.id);
    expect(close.rows[0].summary.dualRelease).toEqual({
      channel: "deposit",
      status: "approved_dual",
      dualRequired: true,
      thresholdUsd: 0,
      preparerIds: [front.id],
      sealedById: om.id,
      degradedOwnerSeal: false,
      policyVersion: 1,
    });
    expect(close.rows[0].summary.degradedOwnerSealFinding).toBeUndefined();

    const closed = await db.admin.query("SELECT status, day_close_id FROM deposits WHERE tenant_id = $1", [tenant.id]);
    expect(closed.rows.every((r) => r.status === "closed" && r.day_close_id !== null)).toBe(true);

    const event = await db.admin.query(
      "SELECT payload, actor_user_id FROM domain_event WHERE tenant_id = $1 AND kind = 'day_close.frozen'",
      [tenant.id]
    );
    expect(event.rows).toHaveLength(1);
    expect(event.rows[0].actor_user_id).toBe(om.id);
    expect(event.rows[0].payload).toMatchObject({
      dualReleaseStatus: "approved_dual",
      dualRequired: true,
      degradedOwnerSeal: false,
      preparerIds: [front.id],
    });

    const again = await tx(
      (d) => freezeDayClose(d, { tenantId: tenant.id, locationId: location.id, businessDate, actorUserId: owner.id, actorName: owner.name }),
      owner
    );
    expect(again).toEqual({ error: "already_frozen" });
  });

  it("degrades to owner-only sealing in a one-person office and records the finding", async () => {
    const result = await tx(
      (d) =>
        freezeDayClose(d, {
          tenantId: solo.id,
          locationId: soloLocation.id,
          businessDate,
          actorUserId: soloOwner.id,
          actorName: soloOwner.name,
        }),
      soloOwner,
      solo.id
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result).toMatchObject({ status: "frozen", sealStatus: "degraded_owner_seal", degradedOwnerSeal: true });

    const close = await db.admin.query("SELECT summary FROM day_closes WHERE tenant_id = $1", [solo.id]);
    expect(close.rows[0].summary.dualRelease).toMatchObject({
      status: "degraded_owner_seal",
      degradedOwnerSeal: true,
      preparerIds: [soloOwner.id],
      sealedById: soloOwner.id,
    });
    expect(close.rows[0].summary.degradedOwnerSealFinding).toMatchObject({
      kind: "degraded_owner_seal",
      why: expect.stringMatching(/recorded as a finding/),
    });

    const snapshot = await tx((d) => getDayCloseSnapshot(d, solo.id, soloLocation.id, businessDate), soloOwner, solo.id);
    expect(snapshot.degradedOwnerSeal).toBe(true);
  });

  describe("the late posting into a sealed day (Increment 1.40)", () => {
    // These cases run after the seal above, so 2026-09-14 at Main is frozen.
    let closeId: string;

    /**
     * Posts one patient payment straight into the ledger and reads back what the
     * database stamped on it. `patient_payment` maps to no release channel, so
     * the dual-release trigger stays out of the way and the case reads only the
     * stamp. `claims` lets a case assert that the writer's own claim is ignored.
     */
    async function post(
      seq: number,
      effectiveDate: string,
      locationId: string,
      claims: { postedAfterClose?: boolean; closedDayId?: string | null } = {},
      role: "app_rw" | "app_append" = "app_rw"
    ) {
      const id = uuidv7(20_200 + seq);
      const runner = role === "app_rw" ? withTenantTransaction : withTenantAppendTransaction;
      await runner(
        tenant.id,
        front.id,
        async (d) => {
          const { sql } = await import("drizzle-orm");
          await d.execute(
            sql`INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket,
                                            amount_cents, effective_date, posted_at, created_by_id, created_by_name,
                                            tender, idempotency_key, posted_after_close, closed_day_id, created_at)
                VALUES (${id}, ${tenant.id}, ${account.id}, ${patient.id}, ${locationId}, 'patient_payment',
                        'undeposited_funds', ${5_000 + seq}, ${effectiveDate}, now(), ${front.id}, ${front.name},
                        'cash', ${`late-${seq}`}, ${claims.postedAfterClose ?? false},
                        ${claims.closedDayId ?? null}, now())`
          );
        },
        env
      );
      const { rows } = await db.admin.query(
        "SELECT posted_after_close, closed_day_id, amount_cents FROM ledger_entries WHERE id = $1",
        [id]
      );
      return rows[0] as { posted_after_close: boolean; closed_day_id: string | null; amount_cents: string };
    }

    beforeAll(async () => {
      await db.admin.query(
        "INSERT INTO locations (id, tenant_id, name, timezone, active, created_at) VALUES ($1, $2, $3, 'America/Chicago', true, now())",
        [annex.id, tenant.id, annex.name]
      );
      await db.admin.query(
        `INSERT INTO patients (id, tenant_id, mrn, first_name, last_name, date_of_birth, primary_location_id, created_by_id, created_by_name)
         VALUES ($1, $2, 'MRN-DC', 'Dana', 'Close', '1988-04-02', $3, $4, 'seed')`,
        [patient.id, tenant.id, location.id, owner.id]
      );
      await db.admin.query(
        `INSERT INTO guarantor_accounts (id, tenant_id, display_name, created_by_id, created_by_name, created_at)
         VALUES ($1, $2, 'Dana Close', $3, 'seed', now())`,
        [account.id, tenant.id, owner.id]
      );
      const { rows } = await db.admin.query(
        "SELECT id FROM day_closes WHERE tenant_id = $1 AND location_id = $2 AND business_date = $3",
        [tenant.id, location.id, businessDate]
      );
      closeId = rows[0].id as string;
      // An open day close on a later date: a row exists, but nothing is sealed.
      await db.admin.query(
        `INSERT INTO day_closes (id, tenant_id, location_id, business_date, status, created_at)
         VALUES ($1, $2, $3, $4, 'open', now())`,
        [uuidv7(20_040), tenant.id, location.id, openDate]
      );
    });

    it("leaves a row unstamped where the day is open, even with a day_closes row on it", async () => {
      const row = await post(1, openDate, location.id);
      expect(row.posted_after_close).toBe(false);
      expect(row.closed_day_id).toBeNull();
    });

    it("stamps a row posted against the frozen day with the day it landed behind", async () => {
      const row = await post(2, businessDate, location.id);
      expect(row.posted_after_close).toBe(true);
      expect(row.closed_day_id).toBe(closeId);
    });

    it("reads the seal of this location only, not another one's", async () => {
      // The Annex's 2026-09-14 was never sealed, so a row against it is not late.
      const row = await post(3, businessDate, annex.id);
      expect(row.posted_after_close).toBe(false);
      expect(row.closed_day_id).toBeNull();
    });

    it("overwrites what the writer claims, in both directions", async () => {
      // A row into an open day claiming to be late, and naming another practice's
      // close: the database says no on both counts.
      const soloClose = await db.admin.query("SELECT id FROM day_closes WHERE tenant_id = $1", [solo.id]);
      const forged = await post(4, openDate, location.id, {
        postedAfterClose: true,
        closedDayId: soloClose.rows[0].id as string,
      });
      expect(forged.posted_after_close).toBe(false);
      expect(forged.closed_day_id).toBeNull();

      // And a row into the frozen day claiming to be ordinary is stamped anyway.
      const denied = await post(5, businessDate, location.id, { postedAfterClose: false });
      expect(denied.posted_after_close).toBe(true);
      expect(denied.closed_day_id).toBe(closeId);
    });

    it("stamps the append role's insert too, which is the held-release path", async () => {
      // The trigger reads day_closes on every insert, so app_append needs SELECT
      // on it. Without the grant this row raises permission denied instead.
      const row = await post(6, businessDate, location.id, {}, "app_append");
      expect(row.posted_after_close).toBe(true);
      expect(row.closed_day_id).toBe(closeId);
    });

    it("names what landed since the seal on the day's snapshot, and totals it", async () => {
      const snapshot = await tx((d) => getDayCloseSnapshot(d, tenant.id, location.id, businessDate), owner);
      expect(snapshot.status).toBe("frozen");
      // Cases 2, 5 and 6 posted against the sealed day; 1, 3 and 4 did not.
      expect(snapshot.latePostings).toHaveLength(3);
      expect(snapshot.latePostingTotalCents).toBe(5_002 + 5_005 + 5_006);
      expect(snapshot.latePostings.every((row) => row.kind === "patient_payment")).toBe(true);
      expect(snapshot.latePostings.every((row) => row.correctsEntryId === null)).toBe(true);
      expect(snapshot.latePostings[0]?.createdByName).toBe(front.name);
      // The seal itself does not move: that is the whole point of recording this.
      expect(snapshot.depositTotalCents).toBe(35_000);

      // The open day, and the day nobody sealed, carry nothing.
      const open = await tx((d) => getDayCloseSnapshot(d, tenant.id, location.id, openDate), owner);
      expect(open.status).toBe("open");
      expect(open.latePostings).toEqual([]);
      expect(open.latePostingTotalCents).toBe(0);
    });
  });

  it("leaves the whole chain verifiable", async () => {
    const verdict = await verifyDatabaseChains(verifier);
    expect(verdict.publish).toBe(true);
  });
});
