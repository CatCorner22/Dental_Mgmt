import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { createBankStatementImport } from "../bank/import";
import { clearReconciliationRun } from "../reconciliation/clear";
import { getReconciliationRun } from "../reconciliation/queries";
import { seedControlPolicy } from "./policy";
import { measureMatchingLive } from "./matchingMeasure";
import { computeSnapshot } from "./snapshots";

/**
 * Detection lag and the 48-hour match rate measured from live bank lines,
 * as app_rw, through the real import path: a statement whose credits match
 * deposits the practice prepared; a debit and an older credit left open;
 * clearance shortening the open lines' lag; the same statement imported
 * twice adding no bank line and matching no deposit twice. Skipped without
 * PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(31_000), name: "Ridgeview Family Dental", slug: "ridgeview-mm" };
const owner = { id: uuidv7(31_001), username: "mm-owner", name: "Riley Owner", role: "admin" };
const front = { id: uuidv7(31_002), username: "mm-front", name: "Jordan Blake", role: "user" };
const location = { id: uuidv7(31_010) };
const bank = { id: uuidv7(31_020) };
const now = new Date("2026-09-16T12:00:00Z");
const importedAt = new Date("2026-09-14T15:00:00Z");

const CSV = [
  "Date,Description,Amount,Reference",
  "2026-09-12,DEPOSIT CASH MAIN,250.00,",
  "2026-09-12,DEPOSIT CHECK 1042,100.00,1042",
  "2026-09-13,ACH MERCHANT FEE,-150.00,",
  "2026-09-10,DEPOSIT CASH MAIN,75.00,",
  "2026-09-15,DEPOSIT CASH MAIN,500.00,",
].join("\n");

describe.skipIf(!adminUrl)("Detection lag and the 48-hour match rate, measured (live)", () => {
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

    // The front desk prepared two deposits on the 12th: the cash drawer and one check.
    for (const [id, method, amount, reference] of [
      [uuidv7(31_100), "cash", 25_000, "bag-12"],
      [uuidv7(31_101), "check", 10_000, "1042"],
    ] as const) {
      await db.admin.query(
        `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                               reference, status, prepared_by_id, prepared_by_name, created_at)
         VALUES ($1, $2, $3, $4, '2026-09-12', $5, $6, $7, 'open', $8, $9, '2026-09-12T22:00:00Z')`,
        [id, tenant.id, location.id, bank.id, method, amount, reference, front.id, front.name]
      );
    }
  }, 60_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("measures nothing before a statement arrives, and the snapshot records that", async () => {
    const m = await tx((d) => measureMatchingLive(d, tenant.id, now));
    expect(m).toMatchObject({ linesInWindow: 0, matchRate48hPct: null, medianLagDays: null });
    const { snapshot } = await tx((d) => computeSnapshot(d, tenant.id, now));
    expect(snapshot.measurements?.matching?.linesInWindow).toBe(0);
    expect(snapshot.assumptions.find((a) => /48-hour match rate/.test(a))).toMatch(/nothing to measure/);
  });

  it("matches the statement's credits to the deposits the practice prepared, and measures lag and rate from the lines", async () => {
    const result = await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: CSV,
        actorUserId: owner.id,
        actorName: owner.name,
        now: importedAt,
      })
    );
    expect(result).toMatchObject({ status: "validated", matchedDepositCount: 2, unmatchedCount: 3, newBankLineCount: 5 });
    runId = result.reconciliationRunId;

    const run = await tx((d) => getReconciliationRun(d, tenant.id, runId));
    const matched = run!.variances.filter((v) => v.kind === "matched_deposit");
    expect(matched).toHaveLength(2);
    expect(matched.map((v) => v.matchRef?.source)).toEqual(["deposit", "deposit"]);
    expect(matched.map((v) => v.matchRef?.preparedByName)).toEqual([front.name, front.name]);
    expect(run!.matchedCents).toBe(35_000);

    // Cohort as of the 16th: lines posted on or before the 14th. The 15th's $500 is too young to count.
    const m = await tx((d) => measureMatchingLive(d, tenant.id, now));
    expect(m).toMatchObject({
      linesInWindow: 4,
      creditsInWindow: 3,
      creditsMatched: 2,
      creditsMatchedWithinDue: 2,
      matchRate48hPct: 66.7,
      medianLagDays: 2.5, // matched on the 14th from the 12th (2, 2); debit open since the 13th (3); credit open since the 10th (6)
      maxLagDays: 6,
      openLines: 2,
    });
    expect(m.why).toMatch(/^2 of 3 bank credits matched a practice deposit within 48 hours \(66\.7%\); median detection lag 2\.5 days across 4 bank lines, 2 still open/);

    const { snapshot } = await tx((d) => computeSnapshot(d, tenant.id, now));
    expect(snapshot.measurements?.matching).toMatchObject({ matchRate48hPct: 66.7, medianLagDays: 2.5 });
    expect(snapshot.assumptions.find((a) => /48-hour match rate/.test(a))).toMatch(/recorded, not scored: 2 of 3 bank credits/);
  });

  it("shortens the open lines' lag to the day the run was cleared", async () => {
    const cleared = await tx((d) =>
      clearReconciliationRun(d, {
        tenantId: tenant.id,
        runId,
        actor: { id: owner.id, role: owner.role, entitlements: ["bank_reconcile", "run_import"], displayName: owner.name },
        now: new Date("2026-09-15T10:00:00Z"),
      })
    );
    expect(cleared.status).toBe("cleared");
    if (cleared.status !== "cleared") return;
    expect(cleared.clearance.degradedOwnerClearance).toBe(false);

    const m = await tx((d) => measureMatchingLive(d, tenant.id, now));
    expect(m).toMatchObject({ linesInWindow: 4, matchRate48hPct: 66.7, medianLagDays: 2, maxLagDays: 5, openLines: 0 });
    expect(m.why).not.toMatch(/still open/);
  });

  it("imports the same statement again without adding a bank line or matching a deposit twice, and the first detection still governs", async () => {
    const again = await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: CSV,
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-16T09:00:00Z"),
      })
    );
    expect(again).toMatchObject({ status: "validated", matchedDepositCount: 0, unmatchedCount: 5, newBankLineCount: 0 });
    expect(again.reconciliationRunId).not.toBe(runId);
    const { rows } = await db.admin.query("SELECT count(*)::int AS n FROM bank_transactions WHERE tenant_id = $1", [tenant.id]);
    expect(rows[0].n).toBe(5);

    const m = await tx((d) => measureMatchingLive(d, tenant.id, now));
    expect(m).toMatchObject({ linesInWindow: 4, creditsMatched: 2, matchRate48hPct: 66.7, medianLagDays: 2, openLines: 0 });
  });
});
