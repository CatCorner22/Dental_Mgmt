import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { createPostgresStore } from "./postgresStore";
import { revokeAllSessionsForTenant } from "./revokeAllSessions";
import { listRevokeAllHistory, REVOKE_HISTORY_LIMIT } from "./revokeHistory";

/**
 * The reason the practice typed, read back (Increment 1.102).
 *
 * Increment 1.90 refuses the act under ten characters and tells the person
 * pressing that what they type "is what the practice reads afterwards". Until
 * this increment nothing read it: `payload->>'reason'` was selected in one
 * place in the repository, a browser test going round the product to Postgres.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const otherTenantId = DEV_TENANTS[1]!.id;
const owner = DEV_USERS[0]!;

describe.skipIf(!adminUrl)("reading the sign-out-everybody acts back (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  const read = () => withTenantTransaction(tenantId, owner.id, (d) => listRevokeAllHistory(d, tenantId), env);

  const at = (minute: number) => new Date(Date.UTC(2026, 3, 1, 9, minute, 0));

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

  it("reads nothing back from a practice that has never done it", async () => {
    expect(await read()).toEqual([]);
  });

  it("reads back what the administrator typed, and who they are", async () => {
    const store = createPostgresStore(env);
    await revokeAllSessionsForTenant(store, {
      tenantId,
      actorUserId: owner.id,
      reason: "Lost phone reported by the front desk",
      at: at(0),
    });
    const [act] = await read();
    expect(act!.reason).toBe("Lost phone reported by the front desk");
    expect(act!.byName).toBe(owner.displayName);
    expect(act!.at).toBe(at(0).toISOString());
    // Nobody was signed in, and the row says so rather than omitting the count.
    expect(act!.revoked).toBe(0);
  });

  it("puts the most recent act first, and keeps the practice's own", async () => {
    const store = createPostgresStore(env);
    await revokeAllSessionsForTenant(store, {
      tenantId,
      actorUserId: owner.id,
      reason: "Second act, later than the first",
      at: at(5),
    });
    /**
     * The other practice's act, written through the same function. A reason
     * names the incident a practice was in the middle of, so one practice
     * reading another's would be the isolation failure this product exists to
     * refuse.
     */
    await revokeAllSessionsForTenant(store, {
      tenantId: otherTenantId,
      actorUserId: DEV_USERS.find((u) => u.tenantId === otherTenantId)!.id,
      reason: "Another practice, another incident",
      at: at(6),
    });
    const acts = await read();
    expect(acts.map((a) => a.reason)).toEqual([
      "Second act, later than the first",
      "Lost phone reported by the front desk",
    ]);
  });

  it("reads back no more than the screen shows", async () => {
    const store = createPostgresStore(env);
    for (let i = 0; i < REVOKE_HISTORY_LIMIT + 2; i++) {
      await revokeAllSessionsForTenant(store, {
        tenantId,
        actorUserId: owner.id,
        reason: `Filling the list, act number ${i}`,
        at: at(10 + i),
      });
    }
    const acts = await read();
    expect(acts).toHaveLength(REVOKE_HISTORY_LIMIT);
    // Newest first, so the newest filler leads and nothing older survives.
    expect(acts[0]!.reason).toBe(`Filling the list, act number ${REVOKE_HISTORY_LIMIT + 1}`);
  });
});
