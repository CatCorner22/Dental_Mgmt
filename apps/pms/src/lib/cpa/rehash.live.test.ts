import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { lastCompleteMonth } from "../controls/attestationCoverage";
import { loadActivePolicy, writePolicyVersion } from "../controls/policy";
import { closeMonth, loadMonthClose } from "./close";
import { computeMonthPackage, packageHash, PACKAGE_SCHEMA_VERSION } from "./package";
import { compareClose, loadRehashBaseline, recordRehashBaseline } from "./rehash";

/**
 * A baseline for a month closed under an older package shape (Increment 1.56).
 *
 * The close's frozen hash records what the accountant received, and
 * `month_closes` refuses every change to it. A baseline is therefore an
 * addition: it says what the month hashes to under the shape in force now, so
 * "has a figure moved?" is answerable again — from the baseline's date rather
 * than from the close's.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const actor = { id: owner.id, name: owner.displayName };
const today = new Date().toISOString().slice(0, 10);
const month = lastCompleteMonth(today);
/** A shape older than the one in force, to stand for every month closed before the last change. */
const OLDER = "package-v3";

describe.skipIf(!adminUrl)("a baseline for an older-shape close (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  /** What the close held before any baseline was taken, so "rewrites nothing" is checked against it. */
  let frozenBeforeBaseline = "";

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  async function baselineCount(): Promise<number> {
    const { rows } = await db.admin.query("SELECT count(*)::int AS n FROM month_close_rehashes WHERE tenant_id = $1", [tenantId]);
    return rows[0].n as number;
  }

  /** The comparison exactly as the package route computes it. */
  async function comparison() {
    return tx(async (d) => {
      const pkg = await computeMonthPackage(d, tenantId, month);
      const close = await loadMonthClose(d, tenantId, month);
      return compareClose({
        closedUnder: close?.packageSchema ?? null,
        closeHash: close?.packageHash ?? null,
        currentSchema: PACKAGE_SCHEMA_VERSION,
        currentHash: packageHash(pkg),
        baseline: await loadRehashBaseline(d, tenantId, month),
      });
    });
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

  it("refuses a month that was never closed: there is nothing frozen to compare against", async () => {
    const before = await baselineCount();
    const refused = await tx((d) => recordRehashBaseline(d, { tenantId, actor, month }));
    expect(refused).toMatchObject({ ok: false, status: 404, code: "not_closed" });
    expect(await comparison()).toEqual({ state: "not_closed" });
    expect(await baselineCount()).toBe(before);
  });

  it("refuses a month closed under the shape in force: its own frozen hash already answers", async () => {
    const closed = await tx((d) => closeMonth(d, { tenantId, actor, month }));
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.close.packageSchema).toBe(PACKAGE_SCHEMA_VERSION);

    const refused = await tx((d) => recordRehashBaseline(d, { tenantId, actor, month }));
    expect(refused).toMatchObject({ ok: false, status: 409, code: "same_shape" });
    // And the comparison answers from the close, as it has since Increment 1.36.
    expect(await comparison()).toMatchObject({ state: "same_shape", movedSinceClose: false });
    // The database refuses such a row even past the service.
    await expect(
      db.admin.query(
        `INSERT INTO month_close_rehashes (id, tenant_id, month, package_schema, package_hash, entry_count, total_cents, computed_by_id, computed_by_name, computed_at)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, 'Riley Owner', now())`,
        [uuidv7(Date.now()), tenantId, month, PACKAGE_SCHEMA_VERSION, "a".repeat(64), owner.id]
      )
    ).rejects.toMatchObject({ message: expect.stringContaining("which is already its baseline") });
  });

  it("claims nothing about movement once the close reads as an older shape", async () => {
    // Stand the close's recorded shape back, as every month closed before the
    // last change already reads. The close row itself is append-only, so this
    // goes in as the admin the way a historical row would have been written.
    await db.admin.query("ALTER TABLE month_closes DISABLE TRIGGER USER");
    await db.admin.query("UPDATE month_closes SET package_schema = $1 WHERE tenant_id = $2 AND month = $3", [OLDER, tenantId, month]);
    await db.admin.query("ALTER TABLE month_closes ENABLE TRIGGER USER");

    const c = await comparison();
    expect(c.state).toBe("older_shape_no_baseline");
    if (c.state !== "older_shape_no_baseline") return;
    expect(c.closedUnder).toBe(OLDER);
    expect(c.sentence).toContain("nothing here can say whether a figure moved");
  });

  it("records the baseline, reaches the chain, and makes the question answerable again from that date", async () => {
    frozenBeforeBaseline = (await tx((d) => loadMonthClose(d, tenantId, month)))!.packageHash;
    const made = await tx((d) => recordRehashBaseline(d, { tenantId, actor, month }));
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.baseline).toMatchObject({ month, packageSchema: PACKAGE_SCHEMA_VERSION, computedByName: owner.displayName });

    const { rows } = await db.admin.query(
      "SELECT kind, payload FROM domain_event WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1",
      [tenantId]
    );
    expect(rows[0].kind).toBe("month.rehash_baseline");
    expect(rows[0].payload).toMatchObject({ month, packageSchema: PACKAGE_SCHEMA_VERSION, closedUnder: OLDER });

    const c = await comparison();
    expect(c).toMatchObject({ state: "older_shape_with_baseline", movedSinceBaseline: false, closedUnder: OLDER });
    if (c.state !== "older_shape_with_baseline") return;
    expect(c.sentence).toContain("runs from the baseline, not from the close");
  });

  it("leaves the close's own frozen hash exactly as it was: the record of what the accountant received", async () => {
    // The claim is that recording a baseline rewrites nothing, so it is checked
    // against what the close held before the baseline was taken. The two hashes
    // happen to agree here, because this suite stands the shape back by
    // relabelling rather than by recomputing a genuinely older package -- the
    // close's figures never moved. That is an artifact of the fixture, and
    // asserting they differ would be asserting the fixture rather than the rule.
    const close = await tx((d) => loadMonthClose(d, tenantId, month));
    expect(close!.packageHash).toBe(frozenBeforeBaseline);
    expect(close!.packageSchema).toBe(OLDER);
    const { rows } = await db.admin.query(
      "SELECT package_hash, package_schema FROM month_close_rehashes WHERE tenant_id = $1 AND month = $2",
      [tenantId, month]
    );
    // Two readings side by side, each naming its own shape; neither replaces the other.
    expect(rows).toHaveLength(1);
    expect(rows[0].package_schema).toBe(PACKAGE_SCHEMA_VERSION);
    expect(rows[0].package_schema).not.toBe(close!.packageSchema);
  });

  it("refuses a second baseline under the same shape, naming who took the first", async () => {
    const before = await baselineCount();
    const again = await tx((d) => recordRehashBaseline(d, { tenantId, actor, month }));
    expect(again).toMatchObject({ ok: false, status: 409, code: "already_baselined" });
    if (again.ok) return;
    expect(again.why).toMatch(new RegExp(`${owner.displayName} took this month's baseline`));
    expect(again.why).toContain("a second would move the line a later comparison is drawn from");
    expect(await baselineCount()).toBe(before);
  });

  it("reports the move once a figure changes, still dated from the baseline", async () => {
    // A closed month's journal cannot move: the database admits a later entry
    // only as a prior_period correction, which posts today and is reported in
    // the month it posts. So the drift is one of the two docs/17 names — here,
    // editing the policy the package reports as in force. (The other, re-mapping
    // a journal line, moves nothing for this month, because a month that has
    // ended on a freshly seeded practice states no journal lines to map.)
    const active = await tx((d) => loadActivePolicy(d, tenantId));
    await tx((d) =>
      writePolicyVersion(d, {
        tenantId,
        version: active!.version + 1,
        // A channel threshold, which the package reports on its coverage table
        // and therefore carries into the hash. A policy field the package does
        // not report would move nothing, and proving that is the point of
        // hashing what the package states rather than what the practice holds.
        policy: {
          ...active!.policy,
          rules: active!.policy.rules.map((r, i) => (i === 0 ? { ...r, thresholdUsd: r.thresholdUsd + 37 } : r)),
        },
        createdById: owner.id,
        createdByName: owner.displayName,
      })
    );

    const c = await comparison();
    expect(c).toMatchObject({ state: "older_shape_with_baseline", movedSinceBaseline: true });
    if (c.state !== "older_shape_with_baseline") return;
    expect(c.sentence).toContain("has moved since the baseline taken on");
    expect(c.sentence).toContain("says only what the accountant received");
  });

  it("is append-only in the database", async () => {
    const { rows } = await db.admin.query("SELECT id FROM month_close_rehashes WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    await expect(
      db.admin.query("UPDATE month_close_rehashes SET package_hash = $1 WHERE id = $2", ["f".repeat(64), rows[0].id])
    ).rejects.toMatchObject({ message: expect.stringContaining("append-only") });
    await expect(db.admin.query("DELETE FROM month_close_rehashes WHERE id = $1", [rows[0].id])).rejects.toMatchObject({
      message: expect.stringContaining("append-only"),
    });
  });

  it("holds no baseline for a month the practice never closed", async () => {
    await expect(
      db.admin.query(
        `INSERT INTO month_close_rehashes (id, tenant_id, month, package_schema, package_hash, entry_count, total_cents, computed_by_id, computed_by_name, computed_at)
         VALUES ($1, $2, '2019-01', $3, $4, 0, 0, $5, 'Riley Owner', now())`,
        [uuidv7(Date.now()), tenantId, PACKAGE_SCHEMA_VERSION, "a".repeat(64), owner.id]
      )
    ).rejects.toMatchObject({ message: expect.stringMatching(/foreign key|month_closes/) });
  });
});
