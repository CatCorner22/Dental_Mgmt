import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { ATTESTABLE_CHANNELS, attestChannelMonth, listMonthAttestations } from "./attestations";

/**
 * The attestation tab on the seeded Ridgeview tenant (Increment 1.51): only a
 * channel the product cannot enforce may be attested, one per month per
 * channel, never rewritten, and the chain records each one.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const accountant = DEV_USERS.find((u) => u.username === "ridgeview-cpa")!;
const asOwner = { id: owner.id, name: owner.displayName };
const asAccountant = { id: accountant.id, name: accountant.displayName };
const month = new Date().toISOString().slice(0, 7);

describe.skipIf(!adminUrl)("attesting an external channel (live)", () => {
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

  async function rowCount(): Promise<number> {
    const { rows } = await db.admin.query("SELECT count(*)::int AS n FROM channel_attestations WHERE tenant_id = $1", [tenantId]);
    return rows[0].n as number;
  }

  it("names exactly the channels this build cannot enforce", () => {
    // Derived from ENFORCEMENT rather than typed twice: moving a channel up to
    // enforced has to take it off this list in the same change.
    expect(ATTESTABLE_CHANNELS).toEqual(["vendor_new", "payroll"]);
  });

  it("lists every attestable channel for the month, attested by nobody yet", async () => {
    const rows = await tx((d) => listMonthAttestations(d, tenantId, month));
    expect(rows.map((r) => r.channel)).toEqual(["vendor_new", "payroll"]);
    expect(rows.every((r) => r.attestation === null)).toBe(true);
  });

  it("refuses a channel the product enforces, a month nobody could have reviewed, and a note that says nothing", async () => {
    const before = await rowCount();

    // An attestation beside evidence the product already holds adds nothing
    // and reads as though it did, so it is refused rather than accepted.
    const enforced = await tx((d) =>
      attestChannelMonth(d, { tenantId, actor: asAccountant, seat: "accountant", month, channel: "writeoff", note: "Reviewed the write-offs for the month." })
    );
    expect(enforced).toMatchObject({ ok: false, status: 400, code: "not_external" });
    if (enforced.ok) return;
    expect(enforced.why).toMatch(/enforces or records writeoff itself/);

    const unknown = await tx((d) =>
      attestChannelMonth(d, { tenantId, actor: asAccountant, seat: "accountant", month, channel: "petty_cash", note: "Reviewed the petty cash." })
    );
    expect(unknown).toMatchObject({ ok: false, status: 400, code: "not_external" });

    const ahead = await tx((d) =>
      attestChannelMonth(d, { tenantId, actor: asAccountant, seat: "accountant", month: "2099-01", channel: "payroll", note: "Reviewed a month that has not happened." })
    );
    expect(ahead).toMatchObject({ ok: false, status: 400, code: "invalid" });

    const thin = await tx((d) =>
      attestChannelMonth(d, { tenantId, actor: asAccountant, seat: "accountant", month, channel: "payroll", note: "ok" })
    );
    expect(thin).toMatchObject({ ok: false, status: 400, code: "invalid" });

    expect(await rowCount()).toBe(before);
  });

  it("records the accountant's attestation with its seat and reaches the chain", async () => {
    const made = await tx((d) =>
      attestChannelMonth(d, {
        tenantId,
        actor: asAccountant,
        seat: "accountant",
        month,
        channel: "payroll",
        note: "Tied the payroll register to the provider's report and to the bank debits for the month.",
      })
    );
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.attestation).toMatchObject({ channel: "payroll", month, seat: "accountant", byName: accountant.displayName });

    const { rows } = await db.admin.query(
      "SELECT kind, payload FROM domain_event WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1",
      [tenantId]
    );
    expect(rows[0].kind).toBe("control.channel_attested");
    expect(rows[0].payload).toMatchObject({ month, channel: "payroll", seat: "accountant" });

    const listed = await tx((d) => listMonthAttestations(d, tenantId, month));
    expect(listed.find((r) => r.channel === "payroll")?.attestation).toMatchObject({ seat: "accountant" });
    // The other channel is still nobody's word.
    expect(listed.find((r) => r.channel === "vendor_new")?.attestation).toBeNull();
  });

  it("refuses a second attestation of the same channel and month, whoever makes it", async () => {
    const again = await tx((d) =>
      attestChannelMonth(d, { tenantId, actor: asOwner, seat: "practice", month, channel: "payroll", note: "The practice would like to say so too." })
    );
    expect(again).toMatchObject({ ok: false, status: 409, code: "already_attested" });
    if (again.ok) return;
    expect(again.why).toMatch(new RegExp(`${accountant.displayName} attested payroll for ${month}`));

    // The practice may attest the channel nobody has spoken for.
    const other = await tx((d) =>
      attestChannelMonth(d, { tenantId, actor: asOwner, seat: "practice", month, channel: "vendor_new", note: "Checked every new vendor this month against the approval emails." })
    );
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.attestation.seat).toBe("practice");
  });

  it("is append-only in the database", async () => {
    const { rows } = await db.admin.query("SELECT id FROM channel_attestations WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    await expect(
      db.admin.query("UPDATE channel_attestations SET note = 'rewritten' WHERE id = $1", [rows[0].id])
    ).rejects.toMatchObject({ message: expect.stringContaining("append-only") });
    await expect(
      db.admin.query("DELETE FROM channel_attestations WHERE id = $1", [rows[0].id])
    ).rejects.toMatchObject({ message: expect.stringContaining("append-only") });

    // And the unique key holds even when the service is bypassed entirely.
    await expect(
      db.admin.query(
        `INSERT INTO channel_attestations (id, tenant_id, month, channel, note, attested_seat, attested_by_id, attested_by_name, attested_at)
         VALUES ($1, $2, $3, 'payroll', 'A second row for one channel and month.', 'practice', $4, 'Riley Owner', now())`,
        [uuidv7(Date.now()), tenantId, month, owner.id]
      )
    ).rejects.toMatchObject({ message: expect.stringContaining("channel_attestations_month_channel_uidx") });
  });
});
