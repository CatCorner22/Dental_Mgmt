import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { createBankStatementImport } from "../bank/import";
import { clearReconciliationRun } from "../reconciliation/clear";
import { countOpenControlFindings, listControlFindings, listOpenBankLines, refreshUnmatchedBankLineFindings } from "./detectors";
import { seedControlPolicy } from "./policy";
import { takeSnapshot } from "./snapshots";

/**
 * The unmatched-bank-line detector on live rows, as app_rw, through the
 * real import and clearance paths: nothing before a statement; findings for
 * the lines older than 48 hours and none for a line posted yesterday; the
 * snapshot freeze running the detector; clearance closing the findings
 * with a reason; a repeat import of the same statement leaving them
 * closed. Skipped without PMS_TEST_POSTGRES_URL; mandatory under
 * PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(33_000), name: "Ridgeview Family Dental", slug: "ridgeview-dt" };
const owner = { id: uuidv7(33_001), username: "dt-owner", name: "Riley Owner", role: "admin" };
const front = { id: uuidv7(33_002), username: "dt-front", name: "Jordan Blake", role: "user" };
const location = { id: uuidv7(33_010) };
const bank = { id: uuidv7(33_020) };
const now = new Date("2026-09-17T14:00:00Z");

const CSV = [
  "Date,Description,Amount,Reference",
  "2026-09-12,DEPOSIT CASH MAIN,250.00,",
  "2026-09-13,ACH MERCHANT FEE,-150.00,",
  "2026-08-10,WIRE FEE,-25.00,",
  "2026-09-16,DEPOSIT CASH MAIN,40.00,",
].join("\n");

describe.skipIf(!adminUrl)("Unmatched bank line detector (live)", () => {
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
    await db.admin.query(
      `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                             reference, status, prepared_by_id, prepared_by_name, created_at)
       VALUES ($1, $2, $3, $4, '2026-09-12', 'cash', 25000, 'bag-12', 'open', $5, $6, '2026-09-12T22:00:00Z')`,
      [uuidv7(33_100), tenant.id, location.id, bank.id, front.id, front.name]
    );
  }, 60_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("records nothing before a statement exists", async () => {
    const summary = await tx((d) => refreshUnmatchedBankLineFindings(d, tenant.id, now));
    expect(summary).toMatchObject({ inserted: 0, open: 0, closed: 0 });
    expect(await tx((d) => countOpenControlFindings(d, tenant.id))).toBe(0);
  });

  it("opens one finding per unmatched line older than 48 hours, graded by age, and none for yesterday's line", async () => {
    const result = await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: CSV,
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-17T09:00:00Z"),
      })
    );
    expect(result).toMatchObject({ matchedDepositCount: 1, unmatchedCount: 3 });
    runId = result.reconciliationRunId;

    const lines = await tx((d) => listOpenBankLines(d, tenant.id, now));
    expect(lines.map((l) => [l.description, l.ageDays]).sort()).toEqual([
      ["ACH MERCHANT FEE", 4],
      ["WIRE FEE", 38],
    ]);

    // The snapshot freeze is where the detectors run in the product.
    await tx((d) => takeSnapshot(d, { tenantId: tenant.id, actor: owner, trigger: "manual", now }));
    const rows = await tx((d) => listControlFindings(d, tenant.id));
    expect(rows).toHaveLength(2);
    const byDesc = new Map(rows.map((r) => [(r.detail as { description: string }).description, r]));
    expect(byDesc.get("ACH MERCHANT FEE")).toMatchObject({ status: "open", severity: "low", kind: "unmatched_bank_line_48h", subjectKind: "bank_transaction" });
    expect(byDesc.get("WIRE FEE")).toMatchObject({ status: "open", severity: "high" });
    expect((byDesc.get("WIRE FEE")!.detail as { sentence: string }).sentence).toBe(
      "A $25.00 bank debit posted 2026-08-10 (WIRE FEE) has had no matching deposit and no clearance for 38 days."
    );
    for (const r of rows) {
      expect(JSON.stringify(r.detail)).not.toMatch(/Riley|Jordan|Owner|Blake/);
    }

    // A second run on the same clock refreshes rather than duplicates.
    const again = await tx((d) => refreshUnmatchedBankLineFindings(d, tenant.id, now));
    expect(again).toMatchObject({ inserted: 0, refreshed: 2, open: 2 });
  });

  it("closes the findings with a reason once the run is cleared, and a repeat import leaves them closed", async () => {
    const cleared = await tx((d) =>
      clearReconciliationRun(d, {
        tenantId: tenant.id,
        runId,
        actor: { id: owner.id, role: owner.role, entitlements: ["bank_reconcile", "run_import"], displayName: owner.name },
        now: new Date("2026-09-17T15:00:00Z"),
      })
    );
    expect(cleared.status).toBe("cleared");
    const later = new Date("2026-09-17T16:00:00Z");
    expect(await tx((d) => refreshUnmatchedBankLineFindings(d, tenant.id, later))).toMatchObject({ closed: 2, open: 0 });
    const rows = await tx((d) => listControlFindings(d, tenant.id));
    expect(rows.every((r) => r.status === "closed" && r.closedReason === "matched or cleared" && r.closedAt)).toBe(true);

    await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: CSV,
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-17T17:00:00Z"),
      })
    );
    expect(await tx((d) => refreshUnmatchedBankLineFindings(d, tenant.id, new Date("2026-09-17T18:00:00Z")))).toMatchObject({
      inserted: 0,
      reopened: 0,
      open: 0,
    });
    expect(await tx((d) => countOpenControlFindings(d, tenant.id))).toBe(0);
  });
});
