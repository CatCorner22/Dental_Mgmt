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
  });
});
