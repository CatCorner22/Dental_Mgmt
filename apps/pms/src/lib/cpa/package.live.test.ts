import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_LEDGER } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { computeMonthPackage, listPackageExports, packageHash, packageRows, recordPackageExport, toCsv } from "./package";

/**
 * The month-end package on the seeded Ridgeview tenant, as app_rw
 * (Increment 1.34): the journal ties to the postings, the register ties to
 * the deposits, the controls in force are the seeded ones, an export is one
 * chain event carrying the hash, the same rows give the same hash, and a new
 * posting moves it. Skipped without PMS_TEST_POSTGRES_URL; mandatory under
 * PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const actor = { id: owner.id, name: owner.displayName };
const month = new Date().toISOString().slice(0, 7);

describe.skipIf(!adminUrl)("CPA month-end package (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("ties the journal to the postings and the register to the deposits, and lists the controls in force", async () => {
    const pkg = await tx((d) => computeMonthPackage(d, tenantId, month));
    expect(pkg.month).toBe(month);
    expect(pkg.period.start).toBe(`${month}-01`);
    const postingsTotal = pkg.counts.money.postings.reduce((n, r) => n + (r.cents ?? 0), 0);
    expect(pkg.journal.totalCents).toBe(postingsTotal);
    expect(pkg.journal.entryCount).toBe(pkg.counts.money.postingCount);
    expect(pkg.depositRegister.count).toBe(pkg.counts.bank.depositsPrepared);
    expect(pkg.tieOut.map((t) => [t.key, t.holds])).toEqual([
      ["journal_equals_postings", true],
      ["register_equals_deposits", true],
      ["chain_verified", false],
    ]);
    expect(pkg.tieOut[2]!.detail).toMatch(/^No chain check recorded yet/);
    expect(pkg.controls.coverage.map((c) => c.channel)).toEqual(["ach", "check", "writeoff", "vendor_new", "deposit", "payroll"]);
    // The development seed carries the engine's demo exceptions beside the after-hours hold; a real tenant
    // (defaultTenantPolicy) starts with the hold alone. Only the enabled, in-window ones are listed.
    expect(pkg.controls.activeExceptions.map((e) => e.id)).toEqual(["ex-lab-recurring", "ex-after-hours-hold"]);
    expect(pkg.controls.activeExceptions.find((e) => e.id === "ex-after-hours-hold")).toMatchObject({ action: "force_dual", channels: ["writeoff", "check"], effectiveTo: null });
    // The seed writes no chain events, so a freshly seeded practice has an empty chain and says so.
    expect(pkg.chain).toMatchObject({ headSeq: null, headHash: null, eventsInMonth: 0, lastCheck: null });
    expect(JSON.stringify(pkg)).not.toMatch(/Riley|Finn|Jane|Doe|Smith/);
    // A month that has not started has no rows; the caller refuses it before asking. A past month reads empty, not wrong.
    const empty = await tx((d) => computeMonthPackage(d, tenantId, "2020-01"));
    expect(empty.journal.rows).toEqual([]);
    expect(empty.counts.chain.events).toBe(0);
  });

  it("records an export on the chain with its hash, keeps the hash while the rows stand, and moves it when they change", async () => {
    const before = await tx((d) => computeMonthPackage(d, tenantId, month));
    const hash = packageHash(before);
    const rows = packageRows(before, hash);
    expect(toCsv(rows)).toContain(`meta,package_hash,${hash},,`);
    expect(await tx((d) => listPackageExports(d, tenantId, month))).toEqual([]);

    await tx((d) =>
      recordPackageExport(d, { tenantId, actor, month, format: "csv", packageHash: hash, rowCount: rows.length, entryCount: before.journal.entryCount, totalCents: before.journal.totalCents })
    );
    const exports = await tx((d) => listPackageExports(d, tenantId, month));
    expect(exports).toHaveLength(1);
    expect(exports[0]).toMatchObject({ format: "csv", packageHash: hash, rowCount: rows.length });
    const chain = await db.admin.query("SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = 'cpa.package_exported'", [tenantId]);
    expect(chain.rows).toHaveLength(1);
    expect(chain.rows[0].payload).toEqual({ month, format: "csv", packageHash: hash, rowCount: rows.length, entryCount: before.journal.entryCount, totalCents: before.journal.totalCents });

    // The export is itself a chain event, so the chain head moved and with it the hash: an export never leaves a month unchanged.
    const afterExport = await tx((d) => computeMonthPackage(d, tenantId, month));
    expect(afterExport.chain.headSeq).toBe((before.chain.headSeq ?? 0) + 1);
    expect(afterExport.chain.headHash).toMatch(/^[0-9a-f]{64}$/);
    expect(packageHash(afterExport)).not.toBe(hash);
    // Compute it twice with nothing between: the same rows give the same hash.
    expect(packageHash(await tx((d) => computeMonthPackage(d, tenantId, month)))).toBe(packageHash(afterExport));

    // A new posting moves the journal and the hash.
    await db.admin.query(
      `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                   effective_date, posted_at, created_by_id, created_by_name, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, 'patient_payment', 'patient_ar', -1000, $6, now(), $7, 'Riley Owner', $8, now())`,
      [uuidv7(36_001), tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, new Date().toISOString().slice(0, 10), owner.id, "cpa-36001"]
    );
    const moved = await tx((d) => computeMonthPackage(d, tenantId, month));
    expect(moved.journal.totalCents).toBe(afterExport.journal.totalCents - 1000);
    expect(moved.journal.entryCount).toBe(afterExport.journal.entryCount + 1);
    expect(packageHash(moved)).not.toBe(packageHash(afterExport));
    expect(moved.tieOut[0]!.holds).toBe(true);
  });
});
