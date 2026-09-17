import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_LEDGER } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { listHardEvents } from "../alerts/hardEvents";
import { closeMonth, listMonthCloses, loadMonthClose, PRIOR_PERIOD_REASON } from "./close";
import { decideMapping, proposeMapping } from "./mappings";
import { computeMonthPackage, packageHash } from "./package";

/**
 * Closing a month on the seeded Ridgeview tenant, as app_rw (Increment
 * 1.36): a month still running refused, a month with unmapped journal
 * lines refused, the close freezing the package hash and writing one chain
 * event, closing twice refused, the row append-only, and the database
 * refusing a later entry effective-dated into the closed month unless it
 * carries reason prior_period. Skipped without PMS_TEST_POSTGRES_URL;
 * mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const asOwner = { id: owner.id, name: owner.displayName };
const asFront = { id: front.id, name: front.displayName };

/** A month that has ended, whatever day this suite runs. */
const CLOSED_MONTH = "2026-08";
const now = new Date("2026-09-17T15:00:00Z");

describe.skipIf(!adminUrl)("Month close (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as = owner) {
    return withTenantTransaction(tenantId, as.id, fn, env);
  }

  /**
   * Posts straight to the table as the administrator, past the dual-release trigger, to exercise the
   * close trigger alone. `postedAt` is explicit because the package windows the journal on posted_at
   * while the close trigger refuses on effective_date: a row seeded into the month being closed has to
   * carry both, and a later correction carries today's posted_at with the closed month's effective_date.
   */
  async function insertEntry(input: { id: string; effectiveDate: string; postedAt: string; reasonCode: string | null; kind?: string }) {
    await db.admin.query("ALTER TABLE ledger_entries DISABLE TRIGGER ledger_entries_dual_release");
    try {
      await db.admin.query(
        `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                     effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'patient_ar', -1000, $7, $11, $8, 'Riley Owner', $9, $10, $11)`,
        [input.id, tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, input.kind ?? "write_off", input.effectiveDate, owner.id, input.reasonCode, `close-${input.id}`, input.postedAt]
      );
    } finally {
      await db.admin.query("ALTER TABLE ledger_entries ENABLE TRIGGER ledger_entries_dual_release");
    }
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
    await db.admin.query("INSERT INTO reason_codes (tenant_id, code, kind, label) VALUES ($1, $2, 'adjustment', 'Prior period correction') ON CONFLICT DO NOTHING", [tenantId, PRIOR_PERIOD_REASON]);
    // One write-off posted inside the month this suite closes, so the month has a journal to freeze.
    await insertEntry({ id: uuidv7(37_001), effectiveDate: "2026-08-14", postedAt: "2026-08-14T15:00:00Z", reasonCode: "courtesy" });
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("refuses a month that has not ended, and one whose journal still holds an unmapped line", async () => {
    const running = await tx((d) => closeMonth(d, { tenantId, actor: asOwner, month: now.toISOString().slice(0, 7), now }));
    expect(running).toEqual({ ok: false, status: 400, errors: ["A month is closed once it has ended; this one is still taking rows."] });
    const notAMonth = await tx((d) => closeMonth(d, { tenantId, actor: asOwner, month: "2026-13", now }));
    expect(notAMonth).toMatchObject({ ok: false, status: 400 });

    const unmapped = await tx((d) => closeMonth(d, { tenantId, actor: asOwner, month: CLOSED_MONTH, now }));
    expect(unmapped).toMatchObject({ ok: false, status: 409 });
    if (unmapped.ok) return;
    expect(unmapped.errors[0]).toMatch(/^1 journal line still have no approved account mapping|^1 journal line still has no approved account mapping|journal line/);
    expect(await tx((d) => listMonthCloses(d, tenantId))).toEqual([]);
  });

  it("closes the month once its lines are mapped, freezing the hash and writing one chain event; a second close is refused", async () => {
    // Map the one line the month holds: the front desk proposes, the owner approves.
    const proposed = await tx(
      (d) => proposeMapping(d, { tenantId, actor: asFront, glBucket: "patient_ar", kind: "write_off", accountCode: "6100", accountName: "Courtesy write-offs", side: "debit" }),
      front
    );
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect((await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: proposed.mapping.id, decision: "approved" }))).ok).toBe(true);

    const pkg = await tx((d) => computeMonthPackage(d, tenantId, CLOSED_MONTH));
    expect(pkg.mappings.unmappedLines).toBe(0);
    const expectedHash = packageHash(pkg);

    const closed = await tx((d) => closeMonth(d, { tenantId, actor: asOwner, month: CLOSED_MONTH, now }));
    expect(closed).toMatchObject({ ok: true });
    if (!closed.ok) return;
    expect(closed.close).toMatchObject({
      month: CLOSED_MONTH,
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      packageHash: expectedHash,
      entryCount: pkg.journal.entryCount,
      totalCents: pkg.journal.totalCents,
      closedByName: owner.displayName,
    });
    expect(await tx((d) => loadMonthClose(d, tenantId, CLOSED_MONTH))).toMatchObject({ packageHash: expectedHash });

    const chain = await db.admin.query("SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = 'month.closed'", [tenantId]);
    expect(chain.rows).toHaveLength(1);
    expect(chain.rows[0].payload).toEqual({
      closeId: closed.close.id,
      month: CLOSED_MONTH,
      packageHash: expectedHash,
      entryCount: pkg.journal.entryCount,
      totalCents: pkg.journal.totalCents,
    });

    const twice = await tx((d) => closeMonth(d, { tenantId, actor: asOwner, month: CLOSED_MONTH, now }));
    expect(twice).toMatchObject({ ok: false, status: 409 });
    if (twice.ok) return;
    expect(twice.errors[0]).toMatch(new RegExp(`^${CLOSED_MONTH} was closed by ${owner.displayName} on \\d{4}-\\d{2}-\\d{2}\\. A closed month is never re-opened\\.$`));
    // The row itself is append-only: the administrator can neither re-open nor erase it.
    await expect(db.admin.query("UPDATE month_closes SET package_hash = $2 WHERE id = $1", [closed.close.id, "0".repeat(64)])).rejects.toThrow(/never re-opened/);
    await expect(db.admin.query("DELETE FROM month_closes WHERE id = $1", [closed.close.id])).rejects.toThrow(/never re-opened/);
  });

  it("refuses a later entry effective-dated into the closed month unless it carries reason prior_period", async () => {
    const today = now.toISOString();
    await expect(insertEntry({ id: uuidv7(37_010), effectiveDate: "2026-08-20", postedAt: today, reasonCode: "courtesy" })).rejects.toThrow(
      /month_closed: write_off effective 2026-08-20 falls in 2026-08, closed to the accountant; post it today with reason prior_period instead/
    );
    // A month with no close is untouched by the trigger.
    await insertEntry({ id: uuidv7(37_011), effectiveDate: "2026-07-20", postedAt: today, reasonCode: "courtesy" });

    // The labelled correction goes through. It posts today, so it lands in today's journal, not in
    // the closed month's: the frozen hash still reproduces, and the accountant reads the correction
    // in the month it was posted, where the reason code names the period it belongs to.
    const frozen = (await tx((d) => loadMonthClose(d, tenantId, CLOSED_MONTH)))!.packageHash;
    const correctionId = uuidv7(37_012);
    await insertEntry({ id: correctionId, effectiveDate: "2026-08-21", postedAt: today, reasonCode: PRIOR_PERIOD_REASON, kind: "adjustment" });
    expect(packageHash(await tx((d) => computeMonthPackage(d, tenantId, CLOSED_MONTH)))).toBe(frozen);
    const thisMonth = await tx((d) => computeMonthPackage(d, tenantId, now.toISOString().slice(0, 7)));
    expect(thisMonth.reasons.rows.find((r) => r.code === PRIOR_PERIOD_REASON)).toMatchObject({ kind: "adjustment", count: 1 });

    // A correction reaching this far back is also a retroactive-dated entry, so the owner's alert
    // board raises it the moment it posts: the close routes the correction, the hard event announces
    // it. The rule is the gap, not the close — an entry effective inside the seven days before it
    // posted raises nothing, however recently the month closed (Increment 1.29's BACKDATE_DAYS).
    const hard = await tx((d) => listHardEvents(d, tenantId, { since: new Date("2026-08-01T00:00:00Z"), now }));
    expect(hard.find((e) => e.subjectId === correctionId)).toMatchObject({
      kind: "retroactive_entry",
      sentence: "A $10.00 adjustment effective 2026-08-21 was posted on 2026-09-17, 27 days after its effective date.",
    });
  });

  it("reports the closed month as changed once a figure it states about the month moves", async () => {
    const frozen = (await tx((d) => loadMonthClose(d, tenantId, CLOSED_MONTH)))!.packageHash;
    expect(packageHash(await tx((d) => computeMonthPackage(d, tenantId, CLOSED_MONTH)))).toBe(frozen);

    // Re-mapping the bucket the closed month's one line sits in changes the account that month
    // reports, so the month no longer reads as the accountant received it and the page says so.
    const proposed = await tx(
      (d) => proposeMapping(d, { tenantId, actor: asFront, glBucket: "patient_ar", kind: "write_off", accountCode: "6150", accountName: "Courtesy write-offs (revised)", side: "debit" }),
      front
    );
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect((await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: proposed.mapping.id, decision: "approved" }))).ok).toBe(true);

    expect(packageHash(await tx((d) => computeMonthPackage(d, tenantId, CLOSED_MONTH)))).not.toBe(frozen);
    // The close row is untouched: it still says what the accountant received.
    expect((await tx((d) => loadMonthClose(d, tenantId, CLOSED_MONTH)))!.packageHash).toBe(frozen);
    expect(await tx((d) => listMonthCloses(d, tenantId))).toHaveLength(1);
  });
});
