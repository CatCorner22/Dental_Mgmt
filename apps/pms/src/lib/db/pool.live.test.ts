import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { getAppendPool, getPool, resetDbPoolForTests } from "./client";

/**
 * A connection the database closes under the pool must not take the process
 * with it (Increment 1.49).
 *
 * `pg` emits `error` on the pool when an idle client fails, and in Node an
 * `error` event with no listener is an uncaught exception. Every routine
 * event that closes a connection — a database restart, a failover, an
 * administrator terminating a backend, a test harness dropping its throwaway
 * database — would otherwise crash the server. CI found it the second way:
 * every test passed and the run failed anyway, on a socket error raised while
 * an unrelated file happened to be running.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();

describe.skipIf(!adminUrl)("the connection pools (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append") };
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("listens for the idle-client failure that would otherwise be an uncaught exception", () => {
    expect(getPool(env).listenerCount("error")).toBe(1);
    expect(getAppendPool(env).listenerCount("error")).toBe(1);
  });

  it("survives the database closing every connection under it, and serves the next caller", async () => {
    const runtime = getPool(env);
    const user = new URL(env.POSTGRES_URL!).username;
    expect((await runtime.query("SELECT 1 AS one")).rows[0]).toEqual({ one: 1 });

    // The client is idle in the pool now. Close it the way a restart or an
    // administrator would: from outside, with the pool none the wiser.
    const killed = await db.admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = current_database() AND usename = $1 AND pid <> pg_backend_pid()`,
      [user]
    );
    expect(killed.rowCount).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 150));

    // Unhandled, the line above would have ended the process rather than this test.
    expect((await runtime.query("SELECT 2 AS two")).rows[0]).toEqual({ two: 2 });
  }, 30_000);
});
