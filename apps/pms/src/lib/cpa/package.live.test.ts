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
      // Nothing is mapped on a fresh practice (Increment 1.35), and the chain has no check yet.
      ["journal_mapped", false],
      // No day is sealed on a fresh practice, so nothing can have landed behind one.
      ["sealed_days_undisturbed", true],
      // And nobody has vouched for the channels the product cannot enforce
      // (Increment 1.52), which is the state that matters rather than a blank.
      ["external_channels_attested", false],
      ["chain_verified", false],
    ]);
    // `decidedAlone` counts the mappings this month's lines were read through
    // that one person both proposed and decided (Increment 1.75); with nothing
    // mapped at all, it is zero for the same reason `approved` is.
    expect(pkg.mappings).toEqual({ approved: 0, pending: 0, unmappedLines: pkg.journal.rows.length, decidedAlone: 0 });
    expect(pkg.sealedDays).toEqual({ closesFrozen: 0, daysDisturbed: [], postings: 0, firstPostings: 0, totalCents: 0 });
    expect(pkg.tieOut.find((t) => t.key === "chain_verified")!.detail).toMatch(/^No chain check recorded yet/);
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
    const endedMonthHash = packageHash(await tx((d) => computeMonthPackage(d, tenantId, "2020-01")));
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

    // The export is itself a chain event, and it falls inside the month being exported, so that
    // month's own event count moves and the hash with it: exporting the current month never leaves
    // it unchanged. A month that has already ended is a different matter — the event falls outside
    // it, and its hash is unmoved. The close depends on exactly that: the hash covers what the
    // package states about the month, never where the practice stands now (Increment 1.36).
    const afterExport = await tx((d) => computeMonthPackage(d, tenantId, month));
    expect(afterExport.chain.headSeq).toBe((before.chain.headSeq ?? 0) + 1);
    expect(afterExport.chain.headHash).toMatch(/^[0-9a-f]{64}$/);
    expect(afterExport.chain.eventsInMonth).toBe(before.chain.eventsInMonth + 1);
    expect(packageHash(afterExport)).not.toBe(hash);
    expect(packageHash(await tx((d) => computeMonthPackage(d, tenantId, "2020-01")))).toBe(endedMonthHash);
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

  // Last, because it seals a day and posts behind it, which the cases above would
  // otherwise see in their own figures.
  it("reports the days of the month the practice sealed and what landed behind them (Increment 1.44)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const clean = await tx((d) => computeMonthPackage(d, tenantId, month));
    expect(clean.sealedDays.daysDisturbed).toEqual([]);
    expect(clean.sealedDays.postings).toBe(0);
    const undisturbed = clean.tieOut.find((t) => t.key === "sealed_days_undisturbed")!;
    expect(undisturbed.holds).toBe(true);
    expect(undisturbed.detail).toMatch(/none disturbed afterward\.$/);
    const cleanHash = packageHash(clean);

    const closeId = uuidv7(36_100);
    await db.admin.query(
      `INSERT INTO day_closes (id, tenant_id, location_id, business_date, status, deposit_total_cents, day_sheet_total_cents,
                               variance_cents, summary, created_at, frozen_at, frozen_by_id, frozen_by_name)
       VALUES ($1, $2, $3, $4, 'frozen', 0, 0, 0, '{}', now(), now(), $5, 'Riley Owner')`,
      [closeId, tenantId, SEED_LEDGER.locationId, today, owner.id]
    );
    // Freezing a day changes the denominator but disturbs nothing, so the tie-out still holds.
    const sealed = await tx((d) => computeMonthPackage(d, tenantId, month));
    expect(sealed.sealedDays.closesFrozen).toBe(1);
    expect(sealed.sealedDays.daysDisturbed).toEqual([]);
    expect(sealed.tieOut.find((t) => t.key === "sealed_days_undisturbed")!.holds).toBe(true);
    // The section is inside the hash, so the count of frozen days moving moves it.
    expect(packageHash(sealed)).not.toBe(cleanHash);

    for (const [seq, cents] of [
      [1, -2_500],
      [2, -1_500],
    ] as const) {
      await db.admin.query(
        `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                     effective_date, posted_at, created_by_id, created_by_name, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, 'patient_payment', 'patient_ar', $6, $7, now(), $8, 'Riley Owner', $9, now())`,
        [uuidv7(36_100 + seq), tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, cents, today, owner.id, `cpa-sealed-${seq}`]
      );
    }

    const disturbed = await tx((d) => computeMonthPackage(d, tenantId, month));
    expect(disturbed.sealedDays.closesFrozen).toBe(1);
    expect(disturbed.sealedDays.daysDisturbed).toEqual([
      { businessDate: today, closes: 1, postings: 2, firstPostings: 2, cents: -4_000 },
    ]);
    expect(disturbed.sealedDays).toMatchObject({ postings: 2, firstPostings: 2, totalCents: -4_000 });

    const tie = disturbed.tieOut.find((t) => t.key === "sealed_days_undisturbed")!;
    expect(tie.holds).toBe(false);
    expect(tie.detail).toMatch(/^2 rows totalling -\$40\.00 landed against 1 of 1 sealed day, 2 of them first postings\./);
    expect(tie.detail).toMatch(/those days read two ways\.$/);
    expect(tie.label).not.toMatch(/Riley|Finn/);

    // The CSV carries the section and its denominator.
    const rows = packageRows(disturbed, packageHash(disturbed));
    const dayRow = rows.find((r) => r.section === "sealed_days" && r.key === today)!;
    expect(dayRow).toMatchObject({ count: 2, cents: -4_000 });
    expect(dayRow.label).toBe(`${today} \u00b7 1 seal \u00b7 2 first postings`);
    expect(rows.find((r) => r.key === "closes_frozen")).toMatchObject({ section: "sealed_days", count: 1 });
  });

  it("names no patient anywhere in the package or its CSV (Increment 1.49)", async () => {
    // The page has claimed this since Increment 1.34, and the outside
    // accountant's seat rests on it: an accountant who receives no protected
    // health information needs no business-associate agreement to read this
    // (docs/05, docs/07 question 25). A claim a seat depends on belongs in a
    // test, so this reads the practice's own patient and guarantor rows and
    // looks for any of them in what the package would hand over.
    const people = await db.admin.query(
      `SELECT id::text AS id, mrn, first_name, last_name FROM patients WHERE tenant_id = $1`,
      [tenantId]
    );
    const accounts = await db.admin.query(
      `SELECT id::text AS id, display_name FROM guarantor_accounts WHERE tenant_id = $1`,
      [tenantId]
    );
    expect(people.rows.length).toBeGreaterThan(0);
    expect(accounts.rows.length).toBeGreaterThan(0);

    const pkg = await tx((d) => computeMonthPackage(d, tenantId, month));
    const asJson = JSON.stringify(pkg);
    const asCsv = toCsv(packageRows(pkg, packageHash(pkg)));

    const identifiers = [
      ...people.rows.flatMap((r) => [r.id as string, r.mrn as string, r.first_name as string, r.last_name as string]),
      ...accounts.rows.flatMap((r) => [r.id as string, r.display_name as string]),
    ].filter((v) => typeof v === "string" && v.length > 1);

    // Both haystacks are real and searchable, so the empty result below is an
    // absence rather than a search that could never have found anything.
    expect([asJson.includes(month), asCsv.includes(month)]).toEqual([true, true]);

    const leaked = identifiers.filter((v) => asJson.includes(v) || asCsv.includes(v));
    expect(leaked).toEqual([]);
  });
});
