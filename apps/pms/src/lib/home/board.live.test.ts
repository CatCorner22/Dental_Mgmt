import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { createBankStatementImport } from "../bank/import";
import { seedControlPolicy } from "../controls/policy";
import { clearReconciliationRun } from "../reconciliation/clear";
import { buildOwnerBoard } from "./board";

/**
 * The owner board from live rows, as app_rw: no bank record before a
 * statement; open variances after one, pointing at the run; yesterday not
 * closed once a deposit lands on an open day; tied and independent once the
 * owner, who neither posted nor prepared, clears. Skipped without
 * PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(32_000), name: "Ridgeview Family Dental", slug: "ridgeview-hb" };
const owner = { id: uuidv7(32_001), username: "hb-owner", name: "Riley Owner", role: "admin" };
const front = { id: uuidv7(32_002), username: "hb-front", name: "Jordan Blake", role: "user" };
const location = { id: uuidv7(32_010) };
const patient = { id: uuidv7(32_030) };
const account = { id: uuidv7(32_031) };
const bank = { id: uuidv7(32_020) };
const now = new Date("2026-09-17T14:00:00Z");

describe.skipIf(!adminUrl)("Owner home board (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  let runId = "";

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as = owner) {
    return withTenantTransaction(tenant.id, as.id, fn, env);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    env = {
      POSTGRES_URL: await db.loginAs("app_rw"),
      APPEND_ROLE_DSN: await db.loginAs("app_append"),
      BCRYPT_COST: "4",
    };
    await db.admin.query("INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())", [tenant.id, tenant.name, tenant.slug]);
    for (const u of [owner, front]) {
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, clinical_role,
                            mfa_enrolled_at, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, 'x', $5, 'unset', now(), now(), now() - interval '2 years')`,
        [u.id, tenant.id, u.username, u.name, u.role]
      );
    }
    for (const [u, entitlement] of [
      [owner, "bank_reconcile"],
      [owner, "run_import"],
      [owner, "approve_writeoffs"],
      [front, "post_payments"],
      [front, "prepare_deposit"],
    ] as const) {
      await db.admin.query(
        `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
         VALUES ($1, $2, $3, $4, now() - interval '1 year')`,
        [uuidv7(), tenant.id, u.id, entitlement]
      );
    }
    await db.admin.query(
      "INSERT INTO locations (id, tenant_id, name, timezone, active, created_at) VALUES ($1, $2, 'Main', 'America/Chicago', true, now())",
      [location.id, tenant.id]
    );
    await db.admin.query(
      "INSERT INTO bank_accounts (id, tenant_id, location_id, display_name, created_at) VALUES ($1, $2, $3, 'Operating', now())",
      [bank.id, tenant.id, location.id]
    );
    await tx((d) => seedControlPolicy(d, { tenantId: tenant.id, createdById: owner.id, createdByName: owner.name }));
    // The front desk banked the drawer on the 12th.
    await db.admin.query(
      `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                             reference, status, prepared_by_id, prepared_by_name, created_at)
       VALUES ($1, $2, $3, $4, '2026-09-12', 'cash', 25000, 'bag-12', 'open', $5, $6, '2026-09-12T22:00:00Z')`,
      [uuidv7(32_100), tenant.id, location.id, bank.id, front.id, front.name]
    );
  }, 60_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("shows no green state before any statement, and the rest of the board from live rows", async () => {
    const b = await tx((d) => buildOwnerBoard(d, tenant.id, owner.id, now));
    expect(b.asOf).toBe("2026-09-17");
    expect(b.yesterday).toMatchObject({ businessDate: "2026-09-16", shape: "triangle", headline: "No bank record yet" });
    expect(b.approvals).toEqual({ waiting: 0, totalCents: 0 });
    expect(b.decisionsDue).toEqual([]);
    expect(b.health.segregationHealth).toBeGreaterThan(0);
    expect(b.health.levers.length).toBeGreaterThan(0);
    expect(b.reconciliation.grade).toBe("stale_import");
    expect(b.matching.linesInWindow).toBe(0);
    // No day is sealed yet, so nothing can have landed behind one. The card says so
    // rather than hiding: an owner who never sees it cannot tell clean from broken.
    expect(b.afterClose.headline).toBe("Nothing posted into a sealed day");
    expect(b.afterClose.window).toEqual({ rows: 0, netCents: 0, daysTouched: 0, firstPostings: 0 });
    expect(b.afterClose.action).toBeNull();
  });

  it("counts the open variances of an imported statement and points at the run", async () => {
    const result = await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: ["Date,Description,Amount", "2026-09-12,DEPOSIT CASH MAIN,250.00", "2026-09-13,ACH MERCHANT FEE,-150.00"].join("\n"),
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-14T15:00:00Z"),
      })
    );
    expect(result).toMatchObject({ matchedDepositCount: 1, unmatchedCount: 1 });
    runId = result.reconciliationRunId;
    const b = await tx((d) => buildOwnerBoard(d, tenant.id, owner.id, now));
    expect(b.yesterday).toMatchObject({ shape: "triangle", headline: "1 variance" });
    expect(b.yesterday.action).toEqual({ label: "Open the variance queue", href: `/reconciliation/${runId}` });
  });

  it("asks for yesterday's close before it grades, once a deposit lands on an open day", async () => {
    const cleared = await tx((d) =>
      clearReconciliationRun(d, {
        tenantId: tenant.id,
        runId,
        actor: { id: owner.id, role: owner.role, entitlements: ["bank_reconcile", "run_import", "approve_writeoffs"], displayName: owner.name },
        now: new Date("2026-09-15T10:00:00Z"),
      })
    );
    expect(cleared.status).toBe("cleared");
    await db.admin.query(
      `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                             reference, status, prepared_by_id, prepared_by_name, created_at)
       VALUES ($1, $2, $3, $4, '2026-09-16', 'check', 10000, '1043', 'open', $5, $6, '2026-09-16T22:00:00Z')`,
      [uuidv7(32_101), tenant.id, location.id, bank.id, front.id, front.name]
    );
    const b = await tx((d) => buildOwnerBoard(d, tenant.id, owner.id, now));
    expect(b.yesterday).toMatchObject({ shape: "half", headline: "Yesterday not closed" });
    expect(b.yesterday.why).toMatch(/for 2026-09-16 at Main and the day is not frozen/);
    expect(b.yesterday.action?.href).toBe("/day-close");
  });

  it("reads tied and independent once yesterday is frozen and the clearer held no custody or recording", async () => {
    await db.admin.query(
      `INSERT INTO day_closes (id, tenant_id, location_id, business_date, status, deposit_total_cents, day_sheet_total_cents,
                               variance_cents, summary, created_at, frozen_at, frozen_by_id, frozen_by_name)
       VALUES ($1, $2, $3, '2026-09-16', 'frozen', 10000, 10000, 0, '{}', now(), now(), $4, $5)`,
      [uuidv7(32_200), tenant.id, location.id, owner.id, owner.name]
    );
    const b = await tx((d) => buildOwnerBoard(d, tenant.id, owner.id, now));
    expect(b.yesterday).toMatchObject({ shape: "filled", headline: "Tied · independent", action: null });
    expect(b.reconciliation.grade).toBe("independent");
    expect(b.matching).toMatchObject({ creditsInWindow: 1, creditsMatchedWithinDue: 1, matchRate48hPct: 100 });
    // 2026-09-16 is sealed now, and nothing has posted behind it.
    expect(b.afterClose.headline).toBe("Nothing posted into a sealed day");
  });

  describe("what has posted into a sealed day (Increment 1.41)", () => {
    // 2026-09-16 is frozen by the case above; these seal 2026-09-12 and an old
    // day as well, then post into each and read the counts back off the board.

    /** One patient payment, effective-dated into whichever day this names. */
    async function post(seq: number, effectiveDate: string) {
      await tx(async (d) => {
        const { sql } = await import("drizzle-orm");
        await d.execute(
          sql`INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket,
                                          amount_cents, effective_date, posted_at, created_by_id, created_by_name,
                                          tender, idempotency_key, created_at)
              VALUES (${uuidv7(32_300 + seq)}, ${tenant.id}, ${account.id}, ${patient.id}, ${location.id},
                      'patient_payment', 'undeposited_funds', ${-1_000 * seq}, ${effectiveDate}, now(),
                      ${front.id}, ${front.name}, 'cash', ${`after-close-${seq}`}, now())`
        );
      }, front);
    }

    async function freeze(seq: number, businessDate: string) {
      await db.admin.query(
        `INSERT INTO day_closes (id, tenant_id, location_id, business_date, status, deposit_total_cents,
                                 day_sheet_total_cents, variance_cents, summary, created_at, frozen_at,
                                 frozen_by_id, frozen_by_name)
         VALUES ($1, $2, $3, $4, 'frozen', 0, 0, 0, '{}', now(), now(), $5, $6)`,
        [uuidv7(32_400 + seq), tenant.id, location.id, businessDate, owner.id, owner.name]
      );
    }

    beforeAll(async () => {
      await db.admin.query(
        `INSERT INTO patients (id, tenant_id, mrn, first_name, last_name, date_of_birth, primary_location_id, created_by_id, created_by_name)
         VALUES ($1, $2, 'MRN-HB', 'Dana', 'Board', '1985-06-11', $3, $4, 'seed')`,
        [patient.id, tenant.id, location.id, owner.id]
      );
      await db.admin.query(
        `INSERT INTO guarantor_accounts (id, tenant_id, display_name, created_by_id, created_by_name, created_at)
         VALUES ($1, $2, 'Dana Board', $3, 'seed', now())`,
        [account.id, tenant.id, owner.id]
      );
    });

    it("leads with the window where an older sealed day moved and yesterday held", async () => {
      await freeze(1, "2026-09-12");
      await post(1, "2026-09-12");
      const b = await tx((d) => buildOwnerBoard(d, tenant.id, owner.id, now));
      expect(b.afterClose.headline).toBe("Postings into closed days: 1 row");
      expect(b.afterClose.why).toMatch(/^Yesterday's seals hold\./);
      expect(b.afterClose.yesterday).toEqual({ rows: 0, netCents: 0, daysTouched: 0, firstPostings: 0 });
      expect(b.afterClose.window).toEqual({ rows: 1, netCents: -1_000, daysTouched: 1, firstPostings: 1 });
      expect(b.afterClose.action).toEqual({ label: "Open the day close", href: "/day-close" });
    });

    it("leads with yesterday once yesterday's own seal moved, and keeps the window behind it", async () => {
      await post(2, "2026-09-16");
      const b = await tx((d) => buildOwnerBoard(d, tenant.id, owner.id, now));
      expect(b.afterClose.headline).toBe("Yesterday changed after close: 1 row");
      expect(b.afterClose.yesterday).toEqual({ rows: 1, netCents: -2_000, daysTouched: 1, firstPostings: 1 });
      expect(b.afterClose.window).toEqual({ rows: 2, netCents: -3_000, daysTouched: 2, firstPostings: 2 });
      expect(b.afterClose.why).toMatch(/last 30 days, 2 rows across 2 sealed days/);
      expect(b.afterClose.action).toEqual({ label: "Open the sealed day", href: "/day-close" });
      // The seal itself is untouched: the board reports the drift, it does not hide it.
      expect(b.yesterday.headline).toBe("Tied \u00b7 independent");
    });

    it("leaves a sealed day older than the window out of the count, while the row keeps its stamp", async () => {
      await freeze(2, "2026-07-15");
      await post(3, "2026-07-15");
      const stamped = await db.admin.query(
        "SELECT posted_after_close, closed_day_id FROM ledger_entries WHERE idempotency_key = $1 AND tenant_id = $2",
        ["after-close-3", tenant.id]
      );
      expect(stamped.rows[0].posted_after_close).toBe(true);
      expect(stamped.rows[0].closed_day_id).not.toBeNull();

      const b = await tx((d) => buildOwnerBoard(d, tenant.id, owner.id, now));
      // The stamp is permanent; the card is a window, and 2026-07-15 is outside it.
      expect(b.afterClose.window).toEqual({ rows: 2, netCents: -3_000, daysTouched: 2, firstPostings: 2 });
    });
  });
});
