import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { currentAddress, setAddress } from "./addresses";

/**
 * Where a notice would go, and who may say so (Increment 1.58).
 *
 * The rule worth proving here is the one the database holds rather than this
 * file: a person sets their own address and nobody else's. An administrator
 * who could write another person's address could redirect that person's
 * notices silently, and the notices are the signal that something has gone
 * unattended.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const other = DEV_USERS.find((u) => u.id !== owner.id && u.tenantId === tenantId)!;

describe.skipIf(!adminUrl)("where a notice would go (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  /** Acting as `actor`, which is what the database checks `app.user_id` against. */
  function tx<T>(actorId: string, fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, actorId, fn, env);
  }

  /**
   * The Postgres message behind a refusal. Drizzle wraps a failed statement in
   * "Failed query: ..." and carries the database's own words on `cause`, so a
   * test that read only the top-level message would pass on any failure at all.
   */
  async function refusalFrom(fn: () => Promise<unknown>): Promise<string> {
    try {
      await fn();
    } catch (e) {
      const err = e as { message: string; cause?: { message?: string } };
      return err.cause?.message ?? err.message;
    }
    throw new Error("expected the database to refuse this, and it did not");
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

  it("holds nothing until somebody says so", async () => {
    // Never set is not the same as withdrawn, and the two must not read alike:
    // one is a person who has not decided, the other a person who has.
    expect(await tx(owner.id, (d) => currentAddress(d, tenantId, owner.id))).toBeNull();
  });

  it("refuses an address a message could not reach, and writes nothing", async () => {
    const result = await tx(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley at example.com"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(400);
    expect(result.code).toBe("malformed");
    expect(result.why).toContain("name@example.com");
    expect(await tx(owner.id, (d) => currentAddress(d, tenantId, owner.id))).toBeNull();
  });

  it("records the address with a chain event that names the act and not the address", async () => {
    const result = await tx(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview.example"));
    expect(result.ok).toBe(true);
    const held = await tx(owner.id, (d) => currentAddress(d, tenantId, owner.id));
    expect(held?.address).toBe("riley@ridgeview.example");

    const { rows } = await db.admin.query(
      "SELECT kind, payload FROM domain_event WHERE tenant_id = $1 AND kind LIKE 'notice.%' ORDER BY seq",
      [tenantId]
    );
    expect(rows.map((r) => r.kind)).toEqual(["notice.address_set"]);
    // The chain is read by people who may govern this practice without being
    // this person. Where somebody is reachable is theirs.
    expect(JSON.stringify(rows[0].payload)).not.toContain("ridgeview.example");
  });

  it("refuses a second act that changes nothing, naming the day the first was made", async () => {
    const result = await tx(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview.example"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(409);
    expect(result.code).toBe("unchanged");
    expect(result.why).toMatch(/already the address on file, recorded on \d{4}-\d{2}-\d{2}/);
  });

  it("changes an address by adding a row, leaving the earlier one saying what it said", async () => {
    const before = await db.admin.query("SELECT count(*)::int AS n FROM notice_addresses WHERE tenant_id = $1", [tenantId]);
    const result = await tx(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley.owner@ridgeview.example"));
    expect(result.ok).toBe(true);
    const after = await db.admin.query(
      "SELECT address FROM notice_addresses WHERE tenant_id = $1 AND user_id = $2 ORDER BY set_at",
      [tenantId, owner.id]
    );
    // Two rows, not one rewritten: "what address was on file that day" is the
    // question an audit asks after a message has gone out.
    expect(after.rows.length).toBe(before.rows[0].n + 1);
    expect(after.rows.map((r) => r.address)).toEqual(["riley@ridgeview.example", "riley.owner@ridgeview.example"]);
    expect((await tx(owner.id, (d) => currentAddress(d, tenantId, owner.id)))?.address).toBe("riley.owner@ridgeview.example");
  });

  it("records a withdrawal as an act rather than removing the row", async () => {
    const result = await tx(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, null));
    expect(result.ok).toBe(true);
    const held = await tx(owner.id, (d) => currentAddress(d, tenantId, owner.id));
    // In force and null: a person who has stopped, not a person who never began.
    expect(held).not.toBeNull();
    expect(held?.address).toBeNull();
    const { rows } = await db.admin.query(
      "SELECT kind FROM domain_event WHERE tenant_id = $1 AND kind LIKE 'notice.%' ORDER BY seq",
      [tenantId]
    );
    expect(rows.map((r) => r.kind)).toEqual(["notice.address_set", "notice.address_set", "notice.address_withdrawn"]);
  });

  it("refuses withdrawing twice, naming the day it was already withdrawn", async () => {
    const result = await tx(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, null));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("unchanged");
    expect(result.why).toMatch(/already receive no messages, recorded on \d{4}-\d{2}-\d{2}/);
  });

  describe("what the database holds past the service", () => {
    it("refuses one person setting another's address", async () => {
      // The service never offers this — `setAddress` is passed the caller's own
      // id — so the refusal is asserted against the database directly, which is
      // where the rule has to live for it to survive a future caller.
      const why = await refusalFrom(() =>
        tx(owner.id, async (d) =>
          d.execute(
            `INSERT INTO notice_addresses (id, tenant_id, user_id, address, set_at)
             VALUES (gen_random_uuid(), '${tenantId}', '${other.id}', 'elsewhere@example.com', now())` as never
          )
        )
      );
      expect(why).toMatch(/a person sets only their own/);
      expect(why).toContain(other.id);
    });

    it("refuses an edit and a delete", async () => {
      const { rows } = await db.admin.query(
        "SELECT id FROM notice_addresses WHERE tenant_id = $1 AND user_id = $2 ORDER BY set_at LIMIT 1",
        [tenantId, owner.id]
      );
      const id = rows[0].id as string;
      await expect(db.admin.query("UPDATE notice_addresses SET address = 'x@y.example' WHERE id = $1", [id])).rejects.toThrow(
        /notice_addresses is append-only/
      );
      await expect(db.admin.query("DELETE FROM notice_addresses WHERE id = $1", [id])).rejects.toThrow(/notice_addresses is append-only/);
    });

    it("refuses an address that could not receive anything", async () => {
      const why = await refusalFrom(() =>
        tx(owner.id, async (d) =>
          d.execute(
            `INSERT INTO notice_addresses (id, tenant_id, user_id, address, set_at)
             VALUES (gen_random_uuid(), '${tenantId}', '${owner.id}', 'not an address', now())` as never
          )
        )
      );
      expect(why).toMatch(/notice_addresses_address_check/);
    });
  });
});
