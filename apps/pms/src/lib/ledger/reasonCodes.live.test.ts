import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_LEDGER } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { addReasonCode, listReasonCodes, loadReasonThresholdCents, renameReasonCode, setReasonCodeActive, setReasonThreshold } from "./reasonCodes";

/**
 * The practice's reason codes as app_rw (Increment 1.45). The code is a
 * foreign key target, so it never changes and a code in use is retired
 * rather than removed; `prior_period` is reserved besides, because the
 * closed-month refusal admits a correction only under it. Every change is
 * a chain event. Skipped without PMS_TEST_POSTGRES_URL; mandatory under
 * PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const actor = { id: owner.id, name: owner.displayName };

describe.skipIf(!adminUrl)("Reason codes (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  async function events(kind: string) {
    const { rows } = await db.admin.query("SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = $2 ORDER BY seq", [tenantId, kind]);
    return rows.map((r) => r.payload as Record<string, unknown>);
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

  it("reads the seeded codes with how many entries cite each, and marks the reserved one", async () => {
    const rows = await tx((d) => listReasonCodes(d, tenantId));
    expect(rows.map((r) => r.code).sort()).toEqual(["contractual_ppo", "correction", "courtesy", "prior_period"]);
    expect(rows.every((r) => r.active)).toBe(true);
    expect(rows.find((r) => r.code === "prior_period")).toMatchObject({ reserved: true, kind: "adjustment" });
    expect(rows.find((r) => r.code === "courtesy")).toMatchObject({ reserved: false, kind: "write_off" });
    // The seed posts two charges and one payment, none of which cites a reason,
    // so every count starts at zero. The count is read from the rows either way.
    expect(rows.every((r) => r.entries === 0)).toBe(true);
  });

  it("adopts a code, refuses a second one by the same name, and refuses a shape the column would not read back", async () => {
    const added = await tx((d) => addReasonCode(d, { tenantId, actor, code: "Insurance_Adjustment", kind: "adjustment", label: "Insurance adjustment" }));
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    // The code is lowercased on the way in: it is a key, and one casing of a key is enough.
    expect(added.row).toMatchObject({ code: "insurance_adjustment", kind: "adjustment", active: true, entries: 0, reserved: false });
    expect(await events("reason_code.added")).toEqual([{ code: "insurance_adjustment", kind: "adjustment", label: "Insurance adjustment" }]);

    const again = await tx((d) => addReasonCode(d, { tenantId, actor, code: "insurance_adjustment", kind: "adjustment", label: "Something else" }));
    expect(again).toMatchObject({ ok: false, status: 409, code: "duplicate" });

    for (const bad of ["9lives", "has space", "a", "UPPER-CASE!"]) {
      const refused = await tx((d) => addReasonCode(d, { tenantId, actor, code: bad, kind: "write_off", label: "No" }));
      expect(refused, bad).toMatchObject({ ok: false, status: 400, code: "invalid" });
    }
    const wrongKind = await tx((d) => addReasonCode(d, { tenantId, actor, code: "nonsense", kind: "not_a_kind", label: "No" }));
    expect(wrongKind).toMatchObject({ ok: false, code: "invalid" });
    expect(wrongKind.ok === false && wrongKind.why).toMatch(/adjustment, write_off, refund, reversal, transfer, variance/);
  });

  it("changes the wording without touching the key, and refuses wording that changes nothing", async () => {
    const renamed = await tx((d) => renameReasonCode(d, { tenantId, actor, code: "courtesy", label: "Goodwill adjustment" }));
    expect(renamed).toMatchObject({ ok: true });
    const rows = await tx((d) => listReasonCodes(d, tenantId));
    expect(rows.find((r) => r.code === "courtesy")).toMatchObject({ label: "Goodwill adjustment" });
    expect(await events("reason_code.relabelled")).toEqual([
      { code: "courtesy", before: "Courtesy adjustment", after: "Goodwill adjustment" },
    ]);
    // The entries citing it are untouched: the label is not what they carry.
    const entries = await db.admin.query("SELECT count(*)::int AS n FROM ledger_entries WHERE tenant_id = $1 AND reason_code = 'courtesy'", [tenantId]);
    expect(entries.rows[0].n).toBe(rows.find((r) => r.code === "courtesy")!.entries);

    expect(await tx((d) => renameReasonCode(d, { tenantId, actor, code: "courtesy", label: "Goodwill adjustment" }))).toMatchObject({
      ok: false,
      code: "unchanged",
    });
    expect(await tx((d) => renameReasonCode(d, { tenantId, actor, code: "nope", label: "x" }))).toMatchObject({ ok: false, status: 404 });
  });

  it("retires a code in use without removing it, and restores it", async () => {
    // Put the code into use first: retiring one nothing cites would prove nothing.
    const cited = uuidv7(38_000);
    await db.admin.query(
      `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                   effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, 'write_off', 'patient_ar', -1500, current_date, now(), $6, 'Riley Owner', 'courtesy', $7, now())`,
      [cited, tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, owner.id, `rc-${cited}`]
    );
    const before = (await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "courtesy")!;
    expect(before.entries).toBe(1);

    const retired = await tx((d) => setReasonCodeActive(d, { tenantId, actor, code: "courtesy", active: false }));
    expect(retired).toMatchObject({ ok: true });
    const after = (await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "courtesy")!;
    expect(after).toMatchObject({ active: false, entries: before.entries });
    expect((await events("reason_code.retired"))[0]).toMatchObject({ code: "courtesy", entries: before.entries });

    // The row is still there and the entries still read: retiring is not deleting,
    // and the database would refuse a delete anyway while an entry cites it.
    await expect(db.admin.query("DELETE FROM reason_codes WHERE tenant_id = $1 AND code = 'courtesy'", [tenantId])).rejects.toThrow(
      /ledger_entries_reason_fk|violates foreign key/
    );

    expect(await tx((d) => setReasonCodeActive(d, { tenantId, actor, code: "courtesy", active: false }))).toMatchObject({
      ok: false,
      code: "unchanged",
    });
    expect(await tx((d) => setReasonCodeActive(d, { tenantId, actor, code: "courtesy", active: true }))).toMatchObject({ ok: true });
    expect((await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "courtesy")).toMatchObject({ active: true });
    expect(await events("reason_code.restored")).toHaveLength(1);
  });

  it("refuses to retire the reason a correction into a closed month must carry", async () => {
    const refused = await tx((d) => setReasonCodeActive(d, { tenantId, actor, code: "prior_period", active: false }));
    expect(refused).toMatchObject({ ok: false, status: 409, code: "reserved" });
    expect(refused.ok === false && refused.why).toMatch(/unable to correct a closed month at all/);
    expect((await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "prior_period")).toMatchObject({ active: true });

    // Its wording is still the practice's to change.
    expect(await tx((d) => renameReasonCode(d, { tenantId, actor, code: "prior_period", label: "Prior period (accountant)" }))).toMatchObject({
      ok: true,
    });
  });

  it("carries no threshold until the practice sets one, and refuses a figure that is not one", async () => {
    // Every row backfilled to NULL in migration 0035: nothing had ever read the
    // column, so no practice had expressed a rule through it.
    const rows = await tx((d) => listReasonCodes(d, tenantId));
    expect(rows.every((r) => r.requiresApprovalOverCents === null)).toBe(true);
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "courtesy"))).toBeNull();
    // And a code the practice does not hold carries none either, rather than raising.
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "never_adopted"))).toBeNull();
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, null))).toBeNull();

    for (const cents of [-1, 12.5]) {
      expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents })), String(cents)).toMatchObject({
        ok: false,
        status: 400,
        code: "invalid",
      });
    }
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "nope", cents: 100 }))).toMatchObject({ ok: false, status: 404 });
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: null }))).toMatchObject({
      ok: false,
      code: "unchanged",
    });
  });

  it("records a threshold change on the chain, and says which way it moved", async () => {
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: 5_000 }))).toMatchObject({ ok: true });
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "courtesy"))).toBe(5_000);
    expect((await events("reason_code.threshold_changed"))[0]).toMatchObject({
      code: "courtesy",
      beforeCents: -1,
      afterCents: 5_000,
      loosened: false,
    });

    // Tightening further is not a loosening; raising it is; clearing it is the loosest of all.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: 2_500 }))).toMatchObject({ ok: true });
    expect((await events("reason_code.threshold_changed"))[1]).toMatchObject({ beforeCents: 5_000, afterCents: 2_500, loosened: false });
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: 9_000 }))).toMatchObject({ ok: true });
    expect((await events("reason_code.threshold_changed"))[2]).toMatchObject({ beforeCents: 2_500, afterCents: 9_000, loosened: true });
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: null }))).toMatchObject({ ok: true });
    expect((await events("reason_code.threshold_changed"))[3]).toMatchObject({ beforeCents: 9_000, afterCents: -1, loosened: true });
  });

  it("tightens the channel at the database, and never loosens it", async () => {
    // The seeded policy holds the writeoff channel to a second person above $150.
    const policy = await db.admin.query("SELECT policy FROM control_policies WHERE tenant_id = $1 ORDER BY version DESC LIMIT 1", [tenantId]);
    const rule = (policy.rows[0].policy as { rules: { channel: string; thresholdUsd: number }[] }).rules.find((r) => r.channel === "writeoff")!;
    expect(rule.thresholdUsd).toBe(150);

    async function writeOff(seq: number, cents: number, code: string) {
      const id = uuidv7(38_100 + seq);
      return db.admin.query(
        `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                     effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, 'write_off', 'patient_ar', $6, current_date, now(), $7, 'Riley Owner', $8, $9, now())`,
        [id, tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, cents, owner.id, code, `rt-${id}`]
      );
    }

    // With no reason rule, $100 sits under the channel's $150 and posts.
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "contractual_ppo"))).toBeNull();
    await expect(writeOff(1, -10_000, "contractual_ppo")).resolves.toBeTruthy();

    // Hold that same reason to $50 and the same figure now needs a second person.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "contractual_ppo", cents: 5_000 }))).toMatchObject({ ok: true });
    await expect(writeOff(2, -10_000, "contractual_ppo")).rejects.toThrow(/dual_release_required[\s\S]*exceeds 5000 cents/);
    // And one under the tightened figure still posts.
    await expect(writeOff(3, -4_000, "contractual_ppo")).resolves.toBeTruthy();

    // Zero holds every one of them, however small.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "contractual_ppo", cents: 0 }))).toMatchObject({ ok: true });
    await expect(writeOff(4, -100, "contractual_ppo")).rejects.toThrow(/dual_release_required[\s\S]*exceeds 0 cents/);

    // A reason set ABOVE the channel never loosens it: least() is the whole rule,
    // or a practice could undo dual release by inventing a reason.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "contractual_ppo", cents: 90_000 }))).toMatchObject({ ok: true });
    await expect(writeOff(5, -20_000, "contractual_ppo")).rejects.toThrow(/dual_release_required[\s\S]*exceeds 15000 cents/);
    // $100 is under the channel's own figure, so it posts, exactly as it did before.
    await expect(writeOff(6, -10_000, "contractual_ppo")).resolves.toBeTruthy();

    // Put it back, so what follows reads the seeded practice.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "contractual_ppo", cents: null }))).toMatchObject({ ok: true });
  });

  it("lets an adopted code reach an entry, which is the whole point of adopting one", async () => {
    // The column is a foreign key, so this insert is the proof that adopting worked.
    const id = uuidv7(38_001);
    await db.admin.query(
      `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                   effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, 'adjustment', 'patient_ar', -500, current_date, now(), $6, 'Riley Owner', 'insurance_adjustment', $7, now())`,
      [id, tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, owner.id, `rc-${id}`]
    );
    expect((await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "insurance_adjustment")!.entries).toBe(1);

    // And one the practice never adopted cannot.
    await expect(
      db.admin.query(
        `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                     effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, 'adjustment', 'patient_ar', -500, current_date, now(), $6, 'Riley Owner', 'never_adopted', $7, now())`,
        [uuidv7(38_002), tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, owner.id, "rc-never"]
      )
    ).rejects.toThrow(/ledger_entries_reason_fk|violates foreign key/);
  });
});
