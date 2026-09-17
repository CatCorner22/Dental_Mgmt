import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { GENESIS_HASH, SET_LOCAL_TENANT_SQL, hashDomainEvent, uuidv7 } from "@pms/db";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { recordDatabaseChains, verifyDatabaseChains } from "@pms/verifier";

/**
 * Swarm 2, db-security lens: the hash chain as the verifier (app_verify) and
 * the daily recorder (app_append) actually see it. Each test asserts what
 * docs/06 promises ("the chain detects tampering") and FAILS on the reference
 * commit. Skipped without PMS_TEST_POSTGRES_URL; mandatory under
 * PMS_TEST_POSTGRES_REQUIRED=1 (liveAdminUrl throws), mirroring live tests.
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(41_000), user: uuidv7(41_001), username: "s2.chain.admin" };
const otherUser = uuidv7(41_002);

describe.skipIf(!adminUrl)("swarm2 db-security: chain integrity (live Postgres)", () => {
  let db: LiveDatabase;
  let verifier: Client;
  let appender: Client;

  async function appendEvent(kind: string, payload: object): Promise<string> {
    const c = db.admin;
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE app_rw");
      await c.query(SET_LOCAL_TENANT_SQL, [tenant.id, tenant.user]);
      const { rows } = await c.query(
        "SELECT hash, seq FROM domain_event WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1",
        [tenant.id]
      );
      const prevHash = (rows[0]?.hash as string | undefined) ?? GENESIS_HASH;
      const seq = Number(rows[0]?.seq ?? 0) + 1;
      const occurredAt = new Date();
      const hash = hashDomainEvent({
        prevHash,
        tenantId: tenant.id,
        kind,
        payload,
        occurredAt: occurredAt.toISOString(),
      });
      const id = uuidv7(occurredAt.getTime());
      await c.query(
        `INSERT INTO domain_event (id, tenant_id, actor_user_id, kind, payload, prev_hash, hash, occurred_at, seq)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, tenant.id, tenant.user, kind, JSON.stringify(payload), prevHash, hash, occurredAt, seq]
      );
      await c.query("COMMIT");
      return id;
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    }
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await db.admin.query(
      "INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())",
      [tenant.id, tenant.username, tenant.username]
    );
    for (const [id, username] of [
      [tenant.user, tenant.username],
      [otherUser, "s2.chain.other"],
    ]) {
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, mfa_secret_enc,
                            mfa_enrolled_at, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, 'x', 'admin', '{}'::jsonb, now(), now(), now())`,
        [id, tenant.id, username, username]
      );
    }
    verifier = new Client({ connectionString: await db.loginAs("app_verify") });
    await verifier.connect();
    appender = new Client({ connectionString: await db.loginAs("app_append") });
    await appender.connect();
  }, 60_000);

  afterAll(async () => {
    await verifier?.end();
    await appender?.end();
    await db?.destroy();
  });

  // Negative control: after the same recording, rewriting the tail row's payload instead makes verifyDatabaseChains publish=false ("hashes match").
  it("S2-db-security-3: deleting the tail of a recorded chain is reported, not published as a clean shorter chain", async () => {
    await appendEvent("auth.signin", { sessionId: "s2-1" });
    await appendEvent("auth.signin", { sessionId: "s2-2" });
    const tail = await appendEvent("auth.signin", { sessionId: "s2-3" });

    const day1 = await recordDatabaseChains(verifier, appender, "2026-09-15");
    expect(day1.recorded).toEqual([expect.objectContaining({ tenantId: tenant.id, ok: true, eventCount: 3 })]);
    const recordedHead = day1.recorded[0]!.headHash;

    // Truncation: the last event vanishes (owner/superuser access, or a
    // restore from a stale backup). Every remaining link still holds.
    await db.admin.query("DELETE FROM domain_event WHERE id = $1", [tail]);

    const after = await verifyDatabaseChains(verifier);
    const day2 = await recordDatabaseChains(verifier, appender, "2026-09-16");
    const chain = after.tenants.find((t) => t.tenantId === tenant.id)!;

    expect({
      verifyPublish: after.publish,
      chainEvents: chain.events,
      chainHeadIsRecordedHead: chain.headHash === recordedHead,
      day2: day2.recorded.map((r) => ({ ok: r.ok, eventCount: r.eventCount })),
    }).toEqual({
      verifyPublish: false,
      chainEvents: 2,
      chainHeadIsRecordedHead: false,
      day2: [{ ok: false, eventCount: 2 }],
    });
  });

  // Negative control: the same UPDATE against `kind` or `payload` makes verifyDatabaseChains publish=false with a "hashes match" objection.
  it("S2-db-security-4: rewriting who acted (actor_user_id) on a historical event breaks the chain", async () => {
    const id = await appendEvent("controls.decision", { decisionId: "s2-actor", outcome: "approved" });
    const before = await verifyDatabaseChains(verifier);
    expect(before.publish).toBe(true);

    await db.admin.query("UPDATE domain_event SET actor_user_id = $2 WHERE id = $1", [id, otherUser]);
    const { rows } = await db.admin.query("SELECT actor_user_id FROM domain_event WHERE id = $1", [id]);

    const after = await verifyDatabaseChains(verifier);
    const chain = after.tenants.find((t) => t.tenantId === tenant.id)!;
    expect({ actorNow: rows[0]!.actor_user_id, publish: after.publish, objections: chain.objections }).toEqual({
      actorNow: otherUser,
      publish: false,
      objections: [expect.objectContaining({ stepId: "hash-agrees", severity: "refuse" })],
    });
  });
});
