import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { uuidv7 } from "@pms/db";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { recordDatabaseChains, verifyDatabaseChains } from "@pms/verifier";
import { createPostgresStore } from "./auth/postgresStore";
import { resetDbPoolForTests } from "./db/client";

/**
 * Swarm 2, db-security lens: the hash chain as the verifier (app_verify) and
 * the daily recorder (app_append) actually see it. Each test asserts what
 * docs/06 control 16 promises (tamper-evident chain, daily head recorded) and
 * hardEvents.ts states ("events did not verify against the recorded head"),
 * and FAILS on the reference commit. Events are appended through the
 * production store so the tests survive a change to the hash scheme.
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under
 * PMS_TEST_POSTGRES_REQUIRED=1 (liveAdminUrl throws), mirroring live tests.
 */

const adminUrl = liveAdminUrl();

type Tenant = { id: string; user: string; username: string };
/** One tenant per test so a truncated chain in one cannot colour the other. */
const truncated: Tenant = { id: uuidv7(41_000), user: uuidv7(41_001), username: "s2.chain.truncated" };
const rewritten: Tenant = { id: uuidv7(42_000), user: uuidv7(42_001), username: "s2.chain.rewritten" };
const otherUser = uuidv7(42_002);

describe.skipIf(!adminUrl)("swarm2 db-security: chain integrity (live Postgres)", () => {
  let db: LiveDatabase;
  let verifier: Client;
  let appender: Client;
  let store: ReturnType<typeof createPostgresStore>;

  /** Appends through postgresStore.appendDomainEvent (app_rw) and returns the new row's id. */
  async function appendEvent(tenant: Tenant, kind: string, payload: Record<string, unknown>): Promise<string> {
    await store.appendDomainEvent({ tenantId: tenant.id, actorUserId: tenant.user, kind, payload, at: new Date() });
    const { rows } = await db.admin.query(
      "SELECT id FROM domain_event WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1",
      [tenant.id]
    );
    return String(rows[0]!.id);
  }

  function forTenant<T extends { tenantId: string }>(tenant: Tenant, list: T[]): T {
    return list.find((t) => t.tenantId === tenant.id)!;
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    const appendUrl = await db.loginAs("app_append");
    store = createPostgresStore({ POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: appendUrl });
    for (const t of [truncated, rewritten]) {
      await db.admin.query(
        "INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())",
        [t.id, t.username, t.username]
      );
    }
    for (const [id, tenantId, username] of [
      [truncated.user, truncated.id, truncated.username],
      [rewritten.user, rewritten.id, rewritten.username],
      [otherUser, rewritten.id, "s2.chain.other"],
    ]) {
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, mfa_secret_enc,
                            mfa_enrolled_at, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, 'x', 'admin', '{}'::jsonb, now(), now(), now())`,
        [id, tenantId, username, username]
      );
    }
    verifier = new Client({ connectionString: await db.loginAs("app_verify") });
    await verifier.connect();
    appender = new Client({ connectionString: appendUrl });
    await appender.connect();
  }, 60_000);

  afterAll(async () => {
    await verifier?.end();
    await appender?.end();
    await resetDbPoolForTests();
    await db?.destroy();
  });

  // Negative control: after the same recording, rewriting the tail row's payload instead makes
  // recordDatabaseChains publish=false and records ok=false ("hash-agrees").
  it("S2-db-security-3: deleting the tail of a recorded chain is refused by the next recording, not recorded as a clean shorter chain", async () => {
    const tenant = truncated;
    await appendEvent(tenant, "auth.signin", { sessionId: "s2-1" });
    await appendEvent(tenant, "auth.signin", { sessionId: "s2-2" });
    const tail = await appendEvent(tenant, "auth.signin", { sessionId: "s2-3" });

    const day1 = await recordDatabaseChains(verifier, appender, "2026-09-15");
    expect(forTenant(tenant, day1.recorded)).toMatchObject({ ok: true, eventCount: 3 });
    const recordedHead = forTenant(tenant, day1.recorded).headHash;

    // Truncation: the last event vanishes (owner/superuser access, or a
    // restore from a stale backup). Every remaining link still holds.
    await db.admin.query("DELETE FROM domain_event WHERE id = $1", [tail]);

    const day2 = await recordDatabaseChains(verifier, appender, "2026-09-16");
    const chain = forTenant(tenant, day2.tenants);
    const { rows: written } = await db.admin.query(
      "SELECT ok, event_count FROM audit_chain_checks WHERE tenant_id = $1 AND day = '2026-09-16'::date",
      [tenant.id]
    );

    // The shorter chain is internally consistent (2 events, head != recorded
    // head). The recorder must not publish it or write ok=true for day 2.
    expect({
      chainEvents: chain.events,
      chainHeadIsRecordedHead: chain.headHash === recordedHead,
      day2Publish: day2.publish,
      day2RecordedOk: day2.recorded.filter((r) => r.tenantId === tenant.id && r.ok).length,
      day2RowsOk: written.filter((r) => r.ok === true).map((r) => ({ event_count: Number(r.event_count) })),
    }).toEqual({
      chainEvents: 2,
      chainHeadIsRecordedHead: false,
      day2Publish: false,
      day2RecordedOk: 0,
      day2RowsOk: [],
    });
  });

  // Negative control: the same UPDATE against `payload` makes verifyDatabaseChains publish=false with a "hash-agrees" refuse objection.
  it("S2-db-security-4: rewriting who acted (actor_user_id) on a historical event breaks the chain", async () => {
    const tenant = rewritten;
    const id = await appendEvent(tenant, "controls.decision", { decisionId: "s2-actor", outcome: "approved" });
    const before = forTenant(tenant, (await verifyDatabaseChains(verifier)).tenants);
    expect(before).toMatchObject({ publish: true, objections: [] });

    await db.admin.query("UPDATE domain_event SET actor_user_id = $2 WHERE id = $1", [id, otherUser]);
    const { rows } = await db.admin.query("SELECT actor_user_id FROM domain_event WHERE id = $1", [id]);

    const chain = forTenant(tenant, (await verifyDatabaseChains(verifier)).tenants);
    expect({
      actorNow: rows[0]!.actor_user_id,
      publish: chain.publish,
      refused: chain.objections.some((o) => o.severity === "refuse"),
    }).toEqual({ actorNow: otherUser, publish: false, refused: true });
  });
});
