import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { GENESIS_HASH, hashDomainEvent } from "./chain";
import { uuidv7 } from "./ids";
import { SET_LOCAL_TENANT_SQL } from "./tenant-context";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "./testing/liveDatabase";

/**
 * Swarm 2, db-security lens. Live Postgres regressions: each test asserts the
 * behaviour the migrations and docs/06 promise and FAILS on the reference
 * commit. Skipped without PMS_TEST_POSTGRES_URL; mandatory when
 * PMS_TEST_POSTGRES_REQUIRED=1 (liveAdminUrl throws), mirroring live.test.ts.
 */

const adminUrl = liveAdminUrl();

type Outcome = { rows: Record<string, unknown>[]; rowCount: number } | { code: string; message: string };

const ridgeview = { id: uuidv7(31_000), user: uuidv7(31_001), username: "s2.ridgeview.admin" };
const oakridge = { id: uuidv7(32_000), user: uuidv7(32_001), username: "s2.oakridge.admin" };

describe.skipIf(!adminUrl)("swarm2 db-security (live Postgres)", () => {
  let db: LiveDatabase;

  async function as<T>(
    role: string,
    tenant: { id: string; user: string } | null,
    fn: (client: Client) => Promise<T>
  ): Promise<T> {
    const client = db.admin;
    await client.query("BEGIN");
    try {
      await client.query(`SET LOCAL ROLE ${role}`);
      if (tenant) await client.query(SET_LOCAL_TENANT_SQL, [tenant.id, tenant.user]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  async function attempt(
    role: string,
    tenant: { id: string; user: string } | null,
    sql: string,
    params: unknown[] = []
  ): Promise<Outcome> {
    try {
      const { rows, rowCount } = await as(role, tenant, (c) => c.query(sql, params));
      return { rows, rowCount: rowCount ?? 0 };
    } catch (error) {
      const pg = error as { code?: string; message: string };
      return { code: pg.code ?? "unknown", message: pg.message };
    }
  }

  async function appendEvent(tenant: { id: string; user: string }, kind: string, payload: object) {
    return as("app_rw", tenant, async (c) => {
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
      return id;
    });
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    for (const t of [ridgeview, oakridge]) {
      await db.admin.query(
        "INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())",
        [t.id, t.username, t.username]
      );
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, mfa_secret_enc,
                            mfa_enrolled_at, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, 'x', 'admin', '{}'::jsonb, now(), now(), now())`,
        [t.user, t.id, t.username, t.username]
      );
    }
  }, 60_000);

  afterAll(async () => {
    await db?.destroy();
  });

  // Negative control: auth_lookup_session($1) as app_rw with no tenant bound returns the row (0002/0003 grant + policy).
  it("S2-db-security-1: auth_lookup_recovery_ceremony returns the ceremony to the runtime role before a tenant is bound", async () => {
    const ceremonyId = uuidv7();
    const insert = await attempt(
      "app_rw",
      ridgeview,
      `INSERT INTO recovery_ceremonies (id, tenant_id, target_user_id, initiated_by, initiated_at, expires_at)
       VALUES ($1, $2, $3, $4, now(), now() + interval '15 minutes')`,
      [ceremonyId, ridgeview.id, oakridge.user, ridgeview.user]
    );
    expect(insert).toMatchObject({ rowCount: 1 });

    // The production store (apps/pms postgresStore.getRecoveryCeremony) calls this
    // SECURITY DEFINER lookup from the pool with no tenant bound, exactly like
    // auth_lookup_session. The owner role must be admitted to the table.
    const lookup = await attempt(
      "app_rw",
      null,
      "SELECT id, tenant_id, target_user_id FROM auth_lookup_recovery_ceremony($1::uuid)",
      [ceremonyId]
    );
    expect(lookup).toEqual({
      rowCount: 1,
      rows: [{ id: ceremonyId, tenant_id: ridgeview.id, target_user_id: oakridge.user }],
    });
  });

  // Negative control: the same UPDATE/DELETE as app_migrate against disclosures raises P0001 (disclosures_no_update trigger).
  it("S2-db-security-2: the table owner cannot rewrite or remove domain_event and phi_access_log rows", async () => {
    const eventId = await appendEvent(ridgeview, "auth.signin", { sessionId: "owner-rewrite" });
    const phiId = uuidv7();
    await as("app_append", ridgeview, (c) =>
      c.query(
        `INSERT INTO phi_access_log (id, tenant_id, user_id, purpose, record_kind, record_ids, at)
         VALUES ($1, $2, $3, 'treatment', 'none', '[]'::jsonb, now())`,
        [phiId, ridgeview.id, ridgeview.user]
      )
    );

    // app_migrate is NOSUPERUSER NOBYPASSRLS; with the tenant bound, RLS admits
    // the row and only a raising trigger (as on every other append-only table)
    // can stop the rewrite.
    const rewriteEvent = await attempt(
      "app_migrate",
      ridgeview,
      "UPDATE domain_event SET actor_user_id = $2 WHERE id = $1 RETURNING seq",
      [eventId, oakridge.user]
    );
    const deleteEvent = await attempt(
      "app_migrate",
      ridgeview,
      "DELETE FROM domain_event WHERE id = $1 RETURNING seq",
      [eventId]
    );
    const rewritePhi = await attempt(
      "app_migrate",
      ridgeview,
      "UPDATE phi_access_log SET user_id = $2 WHERE id = $1 RETURNING id",
      [phiId, oakridge.user]
    );
    const deletePhi = await attempt(
      "app_migrate",
      ridgeview,
      "DELETE FROM phi_access_log WHERE id = $1 RETURNING id",
      [phiId]
    );

    expect({ rewriteEvent, deleteEvent, rewritePhi, deletePhi }).toEqual({
      rewriteEvent: expect.objectContaining({ code: "P0001" }),
      deleteEvent: expect.objectContaining({ code: "P0001" }),
      rewritePhi: expect.objectContaining({ code: "P0001" }),
      deletePhi: expect.objectContaining({ code: "P0001" }),
    });
  });
});
