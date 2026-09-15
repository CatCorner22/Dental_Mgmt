import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "pg";
import { DEFAULT_MIGRATIONS_DIR, HISTORY_TABLE, applyMigrations } from "./migrate";
import { GENESIS_HASH, hashDomainEvent } from "./chain";
import { uuidv7 } from "./ids";
import { SET_LOCAL_TENANT_SQL } from "./tenant-context";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "./testing/liveDatabase";

/**
 * Live Postgres tests. Skipped without PMS_TEST_POSTGRES_URL; mandatory when
 * PMS_TEST_POSTGRES_REQUIRED=1 (CI). Every assertion here is one the SQL-text
 * tests in schema.test.ts cannot make.
 */

const adminUrl = liveAdminUrl();

type Outcome = { rows: Record<string, unknown>[] } | { code: string; message: string };

const ridgeview = { id: uuidv7(1_000), user: uuidv7(1_001), username: "ridgeview.admin" };
const oakridge = { id: uuidv7(2_000), user: uuidv7(2_001), username: "oakridge.admin" };

describe.skipIf(!adminUrl)("live Postgres", () => {
  let db: LiveDatabase;

  /** Runs `fn` in one transaction as `role`, optionally with a tenant bound. */
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
      const { rows } = await as(role, tenant, (c) => c.query(sql, params));
      return { rows };
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
    // Seed two tenants as the administrator (bypasses RLS, as an ops seed would).
    for (const t of [ridgeview, oakridge]) {
      await db.admin.query(
        "INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())",
        [t.id, t.username.split(".")[0], t.username.split(".")[0]]
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

  describe("migrations", () => {
    it("applied every file as app_migrate and recorded it", async () => {
      const { rows } = await db.admin.query(
        `SELECT version, name, applied_by FROM ${HISTORY_TABLE} ORDER BY version`
      );
      expect(rows.map((r) => [r.version, r.name, r.applied_by])).toEqual([
        [1, "init", "app_migrate"],
        [2, "auth_lookup", "app_migrate"],
        [3, "roles_grants", "app_migrate"],
        [4, "domain_event_seq", "app_migrate"],
        [5, "mfa_enrollment", "app_migrate"],
        [6, "audit_chain_checks", "app_migrate"],
        [7, "disclosures_recovery", "app_migrate"],
      ]);
      const owners = await db.admin.query(
        "SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'"
      );
      expect(owners.rows.map((r) => r.tableowner)).toEqual(["app_migrate"]);
    });

    it("is a no-op the second time", async () => {
      const result = await applyMigrations(db.admin);
      expect(result.applied).toEqual([]);
      expect(result.alreadyApplied).toBe(7);
    });

    it("left domain_event with RLS forced after the seq backfill", async () => {
      const { rows } = await db.admin.query(
        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'domain_event'"
      );
      expect(rows).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);
    });

    it("refuses to run when an applied file was rewritten", async () => {
      const dir = mkdtempSync(join(tmpdir(), "pms-drift-"));
      cpSync(DEFAULT_MIGRATIONS_DIR, dir, { recursive: true });
      writeFileSync(join(dir, "0001_init.sql"), "-- rewritten\nSELECT 1;");
      await expect(applyMigrations(db.admin, { dir })).rejects.toThrow(/checksum drift/);
    });

    it("gave the runtime role no way to touch history", async () => {
      const out = await attempt("app_rw", null, `SELECT * FROM ${HISTORY_TABLE}`);
      expect(out).toMatchObject({ code: "42501" });
    });
  });

  describe("row-level security", () => {
    it("a deliberately missing WHERE clause returns only the bound tenant", async () => {
      const seen = await as("app_rw", ridgeview, async (c) => {
        const { rows } = await c.query("SELECT tenant_id FROM users");
        return rows.map((r) => r.tenant_id);
      });
      expect(seen).toEqual([ridgeview.id]);
    });

    it("returns nothing to the runtime role when no tenant is bound", async () => {
      const out = await attempt("app_rw", null, "SELECT id FROM users");
      expect(out).toEqual({ rows: [] });
    });

    it("binds the table owner too (FORCE), so app_migrate cannot read across tenants", async () => {
      const out = await attempt("app_migrate", null, "SELECT id FROM users");
      expect(out).toEqual({ rows: [] });
    });

    it("does not let the migrator inherit the lookup role's open policy", async () => {
      const { rows } = await db.admin.query(
        `SELECT m.inherit_option FROM pg_auth_members m
           JOIN pg_roles r ON r.oid = m.roleid JOIN pg_roles g ON g.oid = m.member
          WHERE r.rolname = 'app_auth_lookup' AND g.rolname = 'app_migrate'`
      );
      expect(rows).toEqual([{ inherit_option: false }]);
    });

    it("refuses a write into another tenant", async () => {
      const out = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO sessions (id, tenant_id, user_id, created_at, last_seen_at, absolute_expires_at, idle_expires_at)
         VALUES ($1, $2, $3, now(), now(), now() + interval '1 day', now() + interval '1 hour')`,
        [uuidv7(), oakridge.id, oakridge.user]
      );
      expect(out).toMatchObject({ code: "42501" });
    });

    it("the tenant binding dies with the transaction", async () => {
      await as("app_rw", ridgeview, async (c) => {
        const { rows } = await c.query("SELECT current_setting('app.tenant_id', true) AS t");
        expect(rows[0].t).toBe(ridgeview.id);
      });
      const { rows } = await db.admin.query("SELECT current_setting('app.tenant_id', true) AS t");
      expect(rows[0].t ?? "").toBe("");
    });
  });

  describe("auth lookups", () => {
    it("find a user by username before any tenant is bound", async () => {
      const out = await attempt("app_rw", null, "SELECT id, tenant_id FROM auth_lookup_user($1)", [
        "RIDGEVIEW.ADMIN",
      ]);
      expect(out).toEqual({ rows: [{ id: ridgeview.user, tenant_id: ridgeview.id }] });
    });

    it("find a session by id before any tenant is bound", async () => {
      const sessionId = uuidv7();
      await as("app_rw", oakridge, (c) =>
        c.query(
          `INSERT INTO sessions (id, tenant_id, user_id, created_at, last_seen_at, absolute_expires_at, idle_expires_at)
           VALUES ($1, $2, $3, now(), now(), now() + interval '1 day', now() + interval '1 hour')`,
          [sessionId, oakridge.id, oakridge.user]
        )
      );
      const out = await attempt("app_rw", null, "SELECT tenant_id, user_id FROM auth_lookup_session($1)", [
        sessionId,
      ]);
      expect(out).toEqual({ rows: [{ tenant_id: oakridge.id, user_id: oakridge.user }] });
    });

    it("are owned by a role that is neither superuser nor BYPASSRLS", async () => {
      const { rows } = await db.admin.query(
        `SELECT p.proname, r.rolname, r.rolsuper, r.rolbypassrls
           FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
          WHERE p.proname LIKE 'auth_lookup%' ORDER BY p.proname`
      );
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect(row.rolname).toBe("app_auth_lookup");
        expect(row.rolsuper).toBe(false);
        expect(row.rolbypassrls).toBe(false);
      }
    });

    it("cannot be called by the append or verify roles", async () => {
      for (const role of ["app_append", "app_verify"]) {
        const out = await attempt(role, null, "SELECT id FROM auth_lookup_user($1)", ["x"]);
        expect(out, role).toMatchObject({ code: "42501" });
      }
    });
  });

  describe("append-only records", () => {
    it("the runtime can append and read a domain event but never rewrite or remove one", async () => {
      const id = await appendEvent(ridgeview, "auth.signin", { sessionId: "s1" });
      const read = await attempt("app_rw", ridgeview, "SELECT kind FROM domain_event WHERE id = $1", [id]);
      expect(read).toEqual({ rows: [{ kind: "auth.signin" }] });

      const update = await attempt(
        "app_rw",
        ridgeview,
        "UPDATE domain_event SET payload = '{}'::jsonb WHERE id = $1",
        [id]
      );
      expect(update).toMatchObject({ code: "42501" });

      const remove = await attempt("app_rw", ridgeview, "DELETE FROM domain_event WHERE id = $1", [id]);
      expect(remove).toMatchObject({ code: "42501" });
    });

    it("a second writer naming the same seq fails instead of forking the chain", async () => {
      const first = await appendEvent(oakridge, "auth.signin", { sessionId: "fork-a" });
      const { rows } = await db.admin.query("SELECT seq, prev_hash FROM domain_event WHERE id = $1", [first]);
      const fork = await attempt(
        "app_rw",
        oakridge,
        `INSERT INTO domain_event (id, tenant_id, kind, payload, prev_hash, hash, occurred_at, seq)
         VALUES ($1, $2, 'auth.signin', '{"sessionId":"fork-b"}', $3, 'deadbeef', now(), $4)`,
        [uuidv7(), oakridge.id, rows[0].prev_hash, rows[0].seq]
      );
      expect(fork).toMatchObject({ code: "23505" });
    });

    it("the append role can insert a PHI access row and cannot read any back", async () => {
      const insert = await attempt(
        "app_append",
        ridgeview,
        `INSERT INTO phi_access_log (id, tenant_id, user_id, purpose, record_kind, record_ids, at)
         VALUES ($1, $2, $3, 'treatment', 'none', '[]'::jsonb, now())`,
        [uuidv7(), ridgeview.id, ridgeview.user]
      );
      expect(insert).toEqual({ rows: [] });
      const read = await attempt("app_append", ridgeview, "SELECT id FROM phi_access_log");
      expect(read).toMatchObject({ code: "42501" });
    });

    it("the runtime cannot delete users or sessions", async () => {
      expect(await attempt("app_rw", ridgeview, "DELETE FROM users WHERE id = $1", [ridgeview.user]))
        .toMatchObject({ code: "42501" });
      expect(await attempt("app_rw", ridgeview, "DELETE FROM sessions")).toMatchObject({
        code: "42501",
      });
    });
  });

  describe("disclosures and recovery", () => {
    it("lets app_append insert a disclosure and refuses to rewrite it", async () => {
      const id = uuidv7();
      const insert = await attempt(
        "app_append",
        ridgeview,
        `INSERT INTO disclosures (id, tenant_id, patient_id, at, channel, recipient, record_ids, purpose, actor_user_id, actor_name)
         VALUES ($1, $2, $3, now(), 'export', 'patient@example.com', '["doc-1"]'::jsonb, 'patient_request', $4, 'Riley Owner')`,
        [id, ridgeview.id, uuidv7(), ridgeview.user]
      );
      expect(insert).toEqual({ rows: [] });
      const rewrite = await attempt(
        "app_append",
        ridgeview,
        "UPDATE disclosures SET recipient = 'x' WHERE id = $1",
        [id]
      );
      expect(rewrite).toMatchObject({ code: "42501" });
    });

    it("refuses a recovery ceremony approved by the same admin", async () => {
      const ceremonyId = uuidv7();
      const insert = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO recovery_ceremonies (id, tenant_id, target_user_id, initiated_by, initiated_at, expires_at)
         VALUES ($1, $2, $3, $4, now(), now() + interval '15 minutes')`,
        [ceremonyId, ridgeview.id, oakridge.user, ridgeview.user]
      );
      expect(insert).toEqual({ rows: [] });
      const approve = await attempt(
        "app_rw",
        ridgeview,
        `UPDATE recovery_ceremonies SET approved_by = $2, approved_at = now() WHERE id = $1`,
        [ceremonyId, ridgeview.user]
      );
      expect(approve).toMatchObject({ code: "23514" });
    });
  });

  describe("audit chain checks", () => {
    it("lets app_append insert a daily row and app_verify read it back", async () => {
      const day = "2026-09-15";
      const insert = await attempt(
        "app_append",
        ridgeview,
        `INSERT INTO audit_chain_checks (tenant_id, day, ok, head_hash, event_count, checked_at)
         VALUES ($1, $2::date, true, $3, 1, now())`,
        [ridgeview.id, day, "abc123"]
      );
      expect(insert).toEqual({ rows: [] });

      const read = await attempt(
        "app_verify",
        null,
        "SELECT ok, head_hash, event_count FROM audit_chain_checks WHERE tenant_id = $1 AND day = $2::date",
        [ridgeview.id, day]
      );
      expect(read).toEqual({ rows: [{ ok: true, head_hash: "abc123", event_count: 1 }] });

      const rewrite = await attempt(
        "app_append",
        ridgeview,
        "UPDATE audit_chain_checks SET ok = false WHERE tenant_id = $1",
        [ridgeview.id]
      );
      expect(rewrite).toMatchObject({ code: "42501" });
    });

    it("lets app_append read the domain_event tip for chain extension", async () => {
      const id = await appendEvent(ridgeview, "auth.signin", { sessionId: "append-read" });
      const read = await attempt(
        "app_append",
        ridgeview,
        "SELECT id FROM domain_event WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1",
        [ridgeview.id]
      );
      expect(read).toEqual({ rows: [{ id }] });
    });
  });

  describe("verifier role", () => {
    it("reads every tenant's chain and nothing else", async () => {
      await appendEvent(oakridge, "auth.signin", { sessionId: "s2" });
      const chains = await attempt(
        "app_verify",
        null,
        "SELECT DISTINCT tenant_id FROM domain_event ORDER BY tenant_id"
      );
      expect(chains).toEqual({
        rows: [ridgeview.id, oakridge.id].sort().map((tenant_id) => ({ tenant_id })),
      });
      for (const table of ["users", "sessions", "phi_access_log", "tenants"]) {
        expect(await attempt("app_verify", null, `SELECT * FROM ${table}`), table).toMatchObject({
          code: "42501",
        });
      }
      expect(
        await attempt("app_verify", null, "DELETE FROM domain_event")
      ).toMatchObject({ code: "42501" });
    });
  });

  describe("BAA gate", () => {
    const insert = `INSERT INTO integration_registry
        (id, tenant_id, vendor, purpose, enabled, baa_signed_at, baa_expires_at, baa_document_ref, created_at)
      VALUES ($1, $2, $3, 'claims', true, $4, $5, $6, now())`;

    it("refuses to enable a connector with no BAA row", async () => {
      const out = await attempt("app_rw", ridgeview, insert, [
        uuidv7(),
        ridgeview.id,
        "clearinghouse-a",
        null,
        null,
        null,
      ]);
      expect(out).toMatchObject({ code: "23514", message: expect.stringContaining("baa_required") });
    });

    it("refuses an expired BAA", async () => {
      const out = await attempt("app_rw", ridgeview, insert, [
        uuidv7(),
        ridgeview.id,
        "clearinghouse-b",
        new Date("2024-01-01"),
        new Date("2025-01-01"),
        "baa/old",
      ]);
      expect(out).toMatchObject({ code: "23514" });
    });

    it("accepts a live BAA", async () => {
      const out = await attempt("app_rw", ridgeview, insert, [
        uuidv7(),
        ridgeview.id,
        "clearinghouse-c",
        new Date("2026-01-01"),
        new Date("2027-01-01"),
        "baa/live",
      ]);
      expect(out).toEqual({ rows: [] });
    });
  });

  describe("throttle table", () => {
    it("lets the runtime record an IP failure with no tenant bound", async () => {
      const put = await attempt(
        "app_rw",
        null,
        "INSERT INTO auth_throttle (key, tenant_id, fail_count, first_fail_at) VALUES ('ip:203.0.113.9', NULL, 1, now())"
      );
      expect(put).toEqual({ rows: [] });
      const read = await attempt("app_rw", null, "SELECT fail_count FROM auth_throttle WHERE key = 'ip:203.0.113.9'");
      expect(read).toEqual({ rows: [{ fail_count: 1 }] });
      const prune = await attempt("app_rw", null, "DELETE FROM auth_throttle WHERE key = 'ip:203.0.113.9'");
      expect(prune).toEqual({ rows: [] });
    });
  });
});
