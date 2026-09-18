import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "pg";
import { DEFAULT_MIGRATIONS_DIR, HISTORY_TABLE, applyMigrations } from "./migrate";
import { GENESIS_HASH, hashDomainEvent } from "./chain";
import { uuidv7 } from "./ids";
import { SET_LOCAL_TENANT_SQL } from "./tenant-context";
import { runRestoreDrill } from "./restore-drill";
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
        [8, "chain_head_anchor", "app_migrate"],
        [9, "patients_accounts", "app_migrate"],
        [10, "ledger_core", "app_migrate"],
        [11, "ledger_views", "app_migrate"],
        [12, "controls", "app_migrate"],
        [13, "controls_risk", "app_migrate"],
        [14, "controls_enforcement", "app_migrate"],
        [15, "import_staging", "app_migrate"],
        [16, "bank_reconciliation", "app_migrate"],
        [17, "day_close_deposits", "app_migrate"],
        [18, "statements", "app_migrate"],
        [19, "control_findings", "app_migrate"],
        [20, "control_findings_ledger", "app_migrate"],
        [21, "control_findings_coverage", "app_migrate"],
        [22, "control_decisions_detector_finding", "app_migrate"],
        [23, "control_decisions_retire", "app_migrate"],
        [24, "digest_acks", "app_migrate"],
        [25, "locations_hours", "app_migrate"],
        [26, "after_hours_hold", "app_migrate"],
        [27, "hard_event_acks", "app_migrate"],
        [28, "gl_mappings", "app_migrate"],
        [29, "month_closes", "app_migrate"],
        [30, "correction_pairs", "app_migrate"],
        [31, "correction_holds", "app_migrate"],
        [32, "late_postings", "app_migrate"],
        [33, "finding_sealed_day_posting", "app_migrate"],
        [34, "package_schema_version", "app_migrate"],
      ]);
      const owners = await db.admin.query(
        "SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'"
      );
      expect(owners.rows.map((r) => r.tableowner)).toEqual(["app_migrate"]);
    });

    it("is a no-op the second time", async () => {
      const result = await applyMigrations(db.admin);
      expect(result.applied).toEqual([]);
      expect(result.alreadyApplied).toBe(34);
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
    it("lets app_append set object_lock_key once after anchoring", async () => {
      const day = "2026-09-16";
      const insert = await attempt(
        "app_append",
        ridgeview,
        `INSERT INTO audit_chain_checks (tenant_id, day, ok, head_hash, event_count, checked_at)
         VALUES ($1, $2::date, true, 'deadbeef', 0, now())`,
        [ridgeview.id, day]
      );
      expect(insert).toEqual({ rows: [] });
      const anchor = await attempt(
        "app_append",
        ridgeview,
        `UPDATE audit_chain_checks SET object_lock_key = $3 WHERE tenant_id = $1 AND day = $2::date`,
        [ridgeview.id, day, "audit-heads/example.json"]
      );
      expect(anchor).toEqual({ rows: [] });
      const rewrite = await attempt(
        "app_append",
        ridgeview,
        `UPDATE audit_chain_checks SET object_lock_key = 'changed' WHERE tenant_id = $1`,
        [ridgeview.id]
      );
      expect(rewrite).toMatchObject({ code: "P0001" });
    });

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
      expect(rewrite).toMatchObject({ code: "P0001" });
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

  describe("restore drill", () => {
    it("appends backup.restore_drill per tenant through app_append", async () => {
      const dir = mkdtempSync(join(tmpdir(), "pms-restore-"));
      const append = await db.connect();
      await append.query("SET ROLE app_append");
      const verdict = await runRestoreDrill(db.admin, append, `file://${dir}`);
      expect(verdict.ok).toBe(true);
      expect(verdict.tenants).toHaveLength(2);
      const read = await attempt(
        "app_verify",
        null,
        "SELECT tenant_id, kind FROM domain_event WHERE kind = 'backup.restore_drill' ORDER BY tenant_id"
      );
      expect(read).toMatchObject({ rows: expect.any(Array) });
      if (!("rows" in read)) throw new Error("expected rows");
      expect(read.rows).toHaveLength(2);
      expect(read.rows.every((row) => row.kind === "backup.restore_drill")).toBe(true);
      expect(read.rows.map((row) => row.tenant_id).sort()).toEqual(
        [ridgeview.id, oakridge.id].sort()
      );
      await append.end();
    });
  });

  describe("ledger kernel", () => {
    const locationId = uuidv7(3_000);
    const patientId = uuidv7(3_001);
    const accountId = uuidv7(3_002);
    const procedureId = uuidv7(3_003);
    const chargeId = uuidv7(3_004);

    beforeAll(async () => {
      await db.admin.query(
        `INSERT INTO locations (id, tenant_id, name, timezone, created_at)
         VALUES ($1, $2, 'Ledger Site', 'America/Chicago', now())`,
        [locationId, ridgeview.id]
      );
      await as("app_rw", ridgeview, async (c) => {
        await c.query(
          `INSERT INTO patients (id, tenant_id, mrn, first_name, last_name, date_of_birth,
                                 primary_location_id, created_by_id, created_by_name)
           VALUES ($1, $2, 'MRN-1', 'Pat', 'One', '1990-01-01', $3, $4, 'seed')`,
          [patientId, ridgeview.id, locationId, ridgeview.user]
        );
        await c.query(
          `INSERT INTO guarantor_accounts (id, tenant_id, display_name, created_by_id, created_by_name, created_at)
           VALUES ($1, $2, 'Pat One', $3, 'seed', now())`,
          [accountId, ridgeview.id, ridgeview.user]
        );
        await c.query(
          `INSERT INTO account_members (id, tenant_id, account_id, patient_id, effective_from, created_at)
           VALUES ($1, $2, $3, $4, '2026-09-01', now())`,
          [uuidv7(3_010), ridgeview.id, accountId, patientId]
        );
        await c.query(
          `INSERT INTO procedures (id, tenant_id, patient_id, cdt_code)
           VALUES ($1, $2, $3, 'D2740')`,
          [procedureId, ridgeview.id, patientId]
        );
        await c.query(
          `INSERT INTO reason_codes (tenant_id, code, kind, label) VALUES
             ($1, 'courtesy', 'write_off', 'Courtesy adjustment'),
             ($1, 'correction', 'reversal', 'Correction')`,
          [ridgeview.id]
        );
      });
    });

    it("lets app_append insert a charge and refuses UPDATE", async () => {
      const insert = await attempt(
        "app_append",
        ridgeview,
        `INSERT INTO ledger_entries (
           id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
           effective_date, posted_at, created_by_id, created_by_name, procedure_id, idempotency_key
         ) VALUES ($1, $2, $3, $4, $5, 'charge', 'patient_ar', 10000, '2026-09-01', now(), $6, 'Dana', $7, 'charge-1')`,
        [chargeId, ridgeview.id, accountId, patientId, locationId, ridgeview.user, procedureId]
      );
      expect(insert).toEqual({ rows: [] });

      const update = await attempt(
        "app_append",
        ridgeview,
        "UPDATE ledger_entries SET amount_cents = 1 WHERE id = $1",
        [chargeId]
      );
      expect(update).toMatchObject({ code: "42501" });
    });

    it("refuses a reversal that does not mirror the original amount", async () => {
      const bad = await attempt(
        "app_append",
        ridgeview,
        `INSERT INTO ledger_entries (
           id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
           effective_date, posted_at, created_by_id, created_by_name, reason_code,
           reverses_entry_id, idempotency_key
         ) VALUES ($1, $2, $3, $4, $5, 'reversal', 'patient_ar', -5000, '2026-09-02', now(), $6,
                   'Dana', 'correction', $7, 'rev-bad')`,
        [uuidv7(3_005), ridgeview.id, accountId, patientId, locationId, ridgeview.user, chargeId]
      );
      expect(bad).toMatchObject({ code: "P0001" });
    });

    it("refuses allocations that exceed the payment", async () => {
      const payId = uuidv7(3_006);
      const insertPay = await attempt(
        "app_append",
        ridgeview,
        `INSERT INTO ledger_entries (
           id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
           effective_date, posted_at, created_by_id, created_by_name, idempotency_key
         ) VALUES ($1, $2, $3, $4, $5, 'patient_payment', 'patient_ar', -4000, '2026-09-02', now(), $6, 'Dana', 'pay-1')`,
        [payId, ridgeview.id, accountId, patientId, locationId, ridgeview.user]
      );
      expect(insertPay).toEqual({ rows: [] });

      const over = await attempt(
        "app_append",
        ridgeview,
        `INSERT INTO payment_allocations (id, tenant_id, payment_entry_id, charge_entry_id, amount_cents)
         VALUES ($1, $2, $3, $4, 5000)`,
        [uuidv7(3_007), ridgeview.id, payId, chargeId]
      );
      expect(over).toMatchObject({ code: "P0001" });
    });
  });

  describe("controls inbox", () => {
    it("stores a pending approval and refuses requester self-approval", async () => {
      const requestId = uuidv7(4_000);
      const insert = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO approval_requests (
           id, tenant_id, status, channel, amount_cents, held_payload, evaluation,
           requester_id, requester_name
         ) VALUES ($1, $2, 'pending', 'writeoff', 30000, '{}'::jsonb, '{}'::jsonb, $3, 'Dana')`,
        [requestId, ridgeview.id, ridgeview.user]
      );
      expect(insert).toEqual({ rows: [] });

      const self = await attempt(
        "app_rw",
        ridgeview,
        `UPDATE approval_requests SET status = 'approved', second_approver_id = $2
         WHERE id = $1`,
        [requestId, ridgeview.user]
      );
      expect(self).toMatchObject({ code: "23514" });
    });
  });

  describe("Precog on live rows", () => {
    const decisionId = uuidv7(5_000);

    it("lets the runtime record a decision and refuses to rewrite or remove it", async () => {
      const insert = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO control_decisions (
           id, tenant_id, subject_kind, subject_id, kind, note, review_by,
           decided_by_id, decided_by_name, decided_at, scoring_version, rulebook_version
         ) VALUES ($1, $2, 'sod_finding', $3, 'accept_residual',
                   'Owner signs the monthly exception report.', '2026-12-01',
                   $4, 'Ridgeview Admin', now(), 'precog-residual-v1.1.0', '0.1.0')`,
        [decisionId, ridgeview.id, `${ridgeview.user}:rule-writeoff`, ridgeview.user]
      );
      expect(insert).toEqual({ rows: [] });

      const rewrite = await attempt(
        "app_rw",
        ridgeview,
        "UPDATE control_decisions SET kind = 'monitor' WHERE id = $1",
        [decisionId]
      );
      expect(rewrite).toMatchObject({ code: "42501" });
      const remove = await attempt("app_rw", ridgeview, "DELETE FROM control_decisions WHERE id = $1", [
        decisionId,
      ]);
      expect(remove).toMatchObject({ code: "42501" });
    });

    it("refuses a decision whose note does not say why", async () => {
      const bare = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO control_decisions (
           id, tenant_id, subject_kind, subject_id, kind, note,
           decided_by_id, decided_by_name, decided_at, scoring_version, rulebook_version
         ) VALUES ($1, $2, 'control', 'c-cash', 'monitor', '   ok   ',
                   $3, 'Ridgeview Admin', now(), 'precog-residual-v1.1.0', '0.1.0')`,
        [uuidv7(5_001), ridgeview.id, ridgeview.user]
      );
      expect(bare).toMatchObject({ code: "23514" });
    });

    it("links a grant to the decision that permitted it", async () => {
      const grant = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, granted_by, effective_from, decision_id)
         VALUES ($1, $2, $3, 'bank_reconcile', $3, now(), $4)`,
        [uuidv7(5_002), ridgeview.id, ridgeview.user, decisionId]
      );
      expect(grant).toEqual({ rows: [] });
      const dangling = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from, decision_id)
         VALUES ($1, $2, $3, 'post_payments', now(), $4)`,
        [uuidv7(5_003), ridgeview.id, ridgeview.user, uuidv7(9_999)]
      );
      expect(dangling).toMatchObject({ code: "23503" });
    });

    it("upserts a finding on (rule, person), closes it, and never deletes it", async () => {
      const findingId = uuidv7(5_004);
      const insert = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO sod_findings (
           id, tenant_id, rule_id, person_id, entitlement_a, entitlement_b, severity, score,
           conflict, rulebook_version, first_seen_at, last_seen_at
         ) VALUES ($1, $2, 'rule-cash-rec', $3, 'post_payments', 'bank_reconcile', 'critical', 88,
                   '{}'::jsonb, '0.1.0', now(), now())`,
        [findingId, ridgeview.id, ridgeview.user]
      );
      expect(insert).toEqual({ rows: [] });
      const duplicate = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO sod_findings (
           id, tenant_id, rule_id, person_id, entitlement_a, entitlement_b, severity, score,
           conflict, rulebook_version, first_seen_at, last_seen_at
         ) VALUES ($1, $2, 'rule-cash-rec', $3, 'post_payments', 'bank_reconcile', 'critical', 90,
                   '{}'::jsonb, '0.1.0', now(), now())`,
        [uuidv7(5_005), ridgeview.id, ridgeview.user]
      );
      expect(duplicate).toMatchObject({ code: "23505" });
      const closeWithoutTime = await attempt(
        "app_rw",
        ridgeview,
        "UPDATE sod_findings SET status = 'closed' WHERE id = $1",
        [findingId]
      );
      expect(closeWithoutTime).toMatchObject({ code: "23514" });
      const close = await attempt(
        "app_rw",
        ridgeview,
        "UPDATE sod_findings SET status = 'closed', closed_at = now() WHERE id = $1",
        [findingId]
      );
      expect(close).toEqual({ rows: [] });
      const remove = await attempt("app_rw", ridgeview, "DELETE FROM sod_findings WHERE id = $1", [findingId]);
      expect(remove).toMatchObject({ code: "42501" });
      const otherTenant = await attempt("app_rw", oakridge, "SELECT id FROM sod_findings");
      expect(otherTenant).toEqual({ rows: [] });
    });

    it("records a detector finding on (kind, subject), closes it with a reason, and never deletes it", async () => {
      const findingId = uuidv7(5_010);
      const subject = uuidv7(5_011);
      const insert = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO control_findings (
           id, tenant_id, kind, subject_kind, subject_id, severity, detail, detector_version, first_seen_at, last_seen_at
         ) VALUES ($1, $2, 'unmatched_bank_line_48h', 'bank_transaction', $3, 'low', '{}'::jsonb, 'detectors-v1', now(), now())`,
        [findingId, ridgeview.id, subject]
      );
      expect(insert).toEqual({ rows: [] });
      const duplicate = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO control_findings (
           id, tenant_id, kind, subject_kind, subject_id, severity, detail, detector_version, first_seen_at, last_seen_at
         ) VALUES ($1, $2, 'unmatched_bank_line_48h', 'bank_transaction', $3, 'medium', '{}'::jsonb, 'detectors-v1', now(), now())`,
        [uuidv7(5_012), ridgeview.id, subject]
      );
      expect(duplicate).toMatchObject({ code: "23505" });
      const unknownKind = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO control_findings (
           id, tenant_id, kind, subject_kind, subject_id, severity, detail, detector_version, first_seen_at, last_seen_at
         ) VALUES ($1, $2, 'accusation', 'bank_transaction', $3, 'low', '{}'::jsonb, 'detectors-v1', now(), now())`,
        [uuidv7(5_013), ridgeview.id, uuidv7(5_014)]
      );
      expect(unknownKind).toMatchObject({ code: "23514" });
      const ledgerKind = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO control_findings (
           id, tenant_id, kind, subject_kind, subject_id, severity, detail, detector_version, first_seen_at, last_seen_at
         ) VALUES ($1, $2, 'release_without_approval', 'ledger_entry', $3, 'high', '{}'::jsonb, 'detectors-v3', now(), now())`,
        [uuidv7(5_015), ridgeview.id, uuidv7(5_016)]
      );
      expect(ledgerKind).toEqual({ rows: [] });
      const closeWithoutReason = await attempt(
        "app_rw",
        ridgeview,
        "UPDATE control_findings SET status = 'closed', closed_at = now() WHERE id = $1",
        [findingId]
      );
      expect(closeWithoutReason).toMatchObject({ code: "23514" });
      const close = await attempt(
        "app_rw",
        ridgeview,
        "UPDATE control_findings SET status = 'closed', closed_at = now(), closed_reason = 'matched' WHERE id = $1",
        [findingId]
      );
      expect(close).toEqual({ rows: [] });
      const remove = await attempt("app_rw", ridgeview, "DELETE FROM control_findings WHERE id = $1", [findingId]);
      expect(remove).toMatchObject({ code: "42501" });
      const otherTenant = await attempt("app_rw", oakridge, "SELECT id FROM control_findings");
      expect(otherTenant).toEqual({ rows: [] });
    });

    it("stamps one digest acknowledgment per period, tenant-isolated, never updated or deleted", async () => {
      const ackId = uuidv7(5_020);
      const hash = "a".repeat(64);
      const insert = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO digest_acks (id, tenant_id, period_start, period_end, summary_hash, event_count, acknowledged_by_id, acknowledged_by_name)
         VALUES ($1, $2, '2026-09-11', '2026-09-17', $3, 12, $4, 'Ridgeview Admin')`,
        [ackId, ridgeview.id, hash, ridgeview.user]
      );
      expect(insert).toEqual({ rows: [] });
      const duplicate = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO digest_acks (id, tenant_id, period_start, period_end, summary_hash, event_count, acknowledged_by_id, acknowledged_by_name)
         VALUES ($1, $2, '2026-09-11', '2026-09-17', $3, 13, $4, 'Ridgeview Admin')`,
        [uuidv7(5_021), ridgeview.id, hash, ridgeview.user]
      );
      expect(duplicate).toMatchObject({ code: "23505" });
      const shortHash = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO digest_acks (id, tenant_id, period_start, period_end, summary_hash, event_count, acknowledged_by_id, acknowledged_by_name)
         VALUES ($1, $2, '2026-09-04', '2026-09-10', 'abc', 1, $3, 'Ridgeview Admin')`,
        [uuidv7(5_022), ridgeview.id, ridgeview.user]
      );
      expect(shortHash).toMatchObject({ code: "23514" });
      const update = await attempt("app_rw", ridgeview, "UPDATE digest_acks SET event_count = 0 WHERE id = $1", [ackId]);
      expect(update).toMatchObject({ code: "42501" });
      const remove = await attempt("app_rw", ridgeview, "DELETE FROM digest_acks WHERE id = $1", [ackId]);
      expect(remove).toMatchObject({ code: "42501" });
      const otherTenant = await attempt("app_rw", oakridge, "SELECT id FROM digest_acks");
      expect(otherTenant).toEqual({ rows: [] });
    });

    it("freezes a snapshot that the runtime can neither rewrite nor remove", async () => {
      const snapshotId = uuidv7(5_006);
      const insert = await attempt(
        "app_rw",
        ridgeview,
        `INSERT INTO control_snapshots (
           id, tenant_id, taken_at, trigger, scoring_version, rulebook_version,
           average_residual, coso_overall, pressure_index, segregation_health,
           open_conflicts, conflicts_without_decision, snapshot
         ) VALUES ($1, $2, now(), 'manual', 'precog-residual-v1.1.0', '0.1.0', 41, 58, 33, 72, 3, 1, '{}'::jsonb)`,
        [snapshotId, ridgeview.id]
      );
      expect(insert).toEqual({ rows: [] });
      expect(
        await attempt("app_rw", ridgeview, "UPDATE control_snapshots SET average_residual = 1 WHERE id = $1", [
          snapshotId,
        ])
      ).toMatchObject({ code: "42501" });
      expect(
        await attempt("app_rw", ridgeview, "DELETE FROM control_snapshots WHERE id = $1", [snapshotId])
      ).toMatchObject({ code: "42501" });
    });
  });

  describe("dual release re-checked on ledger insert", () => {
    // Oakridge gets its own ledger seed so the trigger cases stay independent
    // of the Ridgeview ledger tests above, which run with no policy row.
    const locationId = uuidv7(6_000);
    const patientId = uuidv7(6_001);
    const accountId = uuidv7(6_002);
    const approverId = uuidv7(6_003);
    const pendingRequest = uuidv7(6_010);
    const approvedRequest = uuidv7(6_011);
    let seq = 0;
    const key = () => `oak-${++seq}`;

    const policy = {
      enabled: true,
      hardBlockWithoutSecond: false,
      ownerCanSecondAny: true,
      rules: [
        { channel: "writeoff", enabled: true, thresholdUsd: 150 },
        { channel: "check", enabled: true, thresholdUsd: 500 },
        { channel: "ach", enabled: false, thresholdUsd: 500 },
      ],
      exceptions: [
        { id: "ex-raise", enabled: true, action: "raise_threshold", thresholdUsd: 400, channels: ["writeoff"] },
        { id: "ex-expired", enabled: true, action: "raise_threshold", thresholdUsd: 9000, channels: ["writeoff"], effectiveTo: "2020-01-01" },
        { id: "ex-check-only", enabled: true, action: "waive_dual", channels: ["check"] },
        { id: "ex-force", enabled: true, action: "force_dual", channels: [] },
      ],
    };

    function writeOff(amountCents: number, extra: { approval?: string; exception?: string } = {}) {
      return attempt(
        "app_append",
        oakridge,
        `INSERT INTO ledger_entries (
           id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
           reason_code, effective_date, posted_at, created_by_id, created_by_name, idempotency_key,
           approval_request_id, applied_exception_id
         ) VALUES ($1, $2, $3, $4, $5, 'write_off', 'patient_ar', $6,
                   'courtesy', '2026-09-01', now(), $7, 'Oak Biller', $8, $9, $10)`,
        [uuidv7(), oakridge.id, accountId, patientId, locationId, amountCents, oakridge.user, key(),
         extra.approval ?? null, extra.exception ?? null]
      );
    }

    beforeAll(async () => {
      await db.admin.query(
        `INSERT INTO locations (id, tenant_id, name, timezone, created_at)
         VALUES ($1, $2, 'Oak Site', 'America/Chicago', now())`,
        [locationId, oakridge.id]
      );
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, mfa_secret_enc,
                            mfa_enrolled_at, password_changed_at, created_at)
         VALUES ($1, $2, 'oakridge.partner', 'Oak Partner', 'x', 'admin', '{}'::jsonb, now(), now(), now())`,
        [approverId, oakridge.id]
      );
      await as("app_rw", oakridge, async (c) => {
        await c.query(
          `INSERT INTO patients (id, tenant_id, mrn, first_name, last_name, date_of_birth,
                                 primary_location_id, created_by_id, created_by_name)
           VALUES ($1, $2, 'MRN-OAK', 'Oak', 'One', '1985-01-01', $3, $4, 'seed')`,
          [patientId, oakridge.id, locationId, oakridge.user]
        );
        await c.query(
          `INSERT INTO guarantor_accounts (id, tenant_id, display_name, created_by_id, created_by_name, created_at)
           VALUES ($1, $2, 'Oak One', $3, 'seed', now())`,
          [accountId, oakridge.id, oakridge.user]
        );
        await c.query(
          `INSERT INTO reason_codes (tenant_id, code, kind, label) VALUES ($1, 'courtesy', 'write_off', 'Courtesy')`,
          [oakridge.id]
        );
        await c.query(
          `INSERT INTO control_policies (id, tenant_id, version, rulebook_version, policy, created_by_id, created_by_name)
           VALUES ($1, $2, 1, '0.1.0', $3::jsonb, $4, 'seed')`,
          [uuidv7(6_020), oakridge.id, JSON.stringify(policy), oakridge.user]
        );
        for (const [id, status] of [[pendingRequest, "pending"], [approvedRequest, "pending"]] as const) {
          await c.query(
            `INSERT INTO approval_requests (id, tenant_id, status, channel, amount_cents, held_payload, evaluation, requester_id, requester_name)
             VALUES ($1, $2, $3, 'writeoff', 30000, '{}'::jsonb, '{}'::jsonb, $4, 'Oak Biller')`,
            [id, oakridge.id, status, oakridge.user]
          );
        }
        await c.query(
          `UPDATE approval_requests SET status = 'approved', second_approver_id = $2, decided_at = now() WHERE id = $1`,
          [approvedRequest, approverId]
        );
      });
    });

    it("lets a write-off at or under the channel threshold post with nothing attached", async () => {
      expect(await writeOff(-15000)).toEqual({ rows: [] });
    });

    it("refuses a write-off above the threshold that cites no approved request", async () => {
      const out = await writeOff(-30000);
      expect(out).toMatchObject({ code: "P0001" });
      expect((out as { message: string }).message).toMatch(/dual_release_required: write_off of 30000 cents on channel writeoff exceeds 15000 cents/);
    });

    it("refuses a request that is still pending, and one decided by the requester", async () => {
      const pending = await writeOff(-30000, { approval: pendingRequest });
      expect(pending).toMatchObject({ code: "P0001" });
      expect((pending as { message: string }).message).toMatch(/is pending, not approved/);

      // A request "approved" by the same person who posts it: the CHECK
      // constraint refuses the update; the trigger would refuse the insert too.
      const self = await attempt(
        "app_rw",
        oakridge,
        `UPDATE approval_requests SET status = 'approved', second_approver_id = $2 WHERE id = $1`,
        [pendingRequest, oakridge.user]
      );
      expect(self).toMatchObject({ code: "23514" });
    });

    it("refuses an approved request whose amount or channel does not match the entry", async () => {
      const wrongAmount = await writeOff(-31000, { approval: approvedRequest });
      expect(wrongAmount).toMatchObject({ code: "P0001" });
      expect((wrongAmount as { message: string }).message).toMatch(/approved 30000 cents, not 31000/);
    });

    it("posts once against an approved request decided by a different person, never twice", async () => {
      expect(await writeOff(-30000, { approval: approvedRequest })).toEqual({ rows: [] });
      const again = await writeOff(-30000, { approval: approvedRequest });
      expect(again).toMatchObject({ code: "23505" });
    });

    it("honours a raise exception in the active policy up to its threshold, and no further", async () => {
      expect(await writeOff(-30000, { exception: "ex-raise" })).toEqual({ rows: [] });
      const over = await writeOff(-50000, { exception: "ex-raise" });
      expect(over).toMatchObject({ code: "P0001" });
      expect((over as { message: string }).message).toMatch(/raises the threshold only to 40000 cents/);
    });

    it("refuses an expired, wrong-channel, unknown, or non-licensing exception", async () => {
      expect((await writeOff(-30000, { exception: "ex-expired" }) as { message: string }).message).toMatch(/has expired/);
      expect((await writeOff(-30000, { exception: "ex-check-only" }) as { message: string }).message).toMatch(
        /does not cover channel writeoff/
      );
      expect((await writeOff(-30000, { exception: "ex-nope" }) as { message: string }).message).toMatch(
        /is not in the active policy/
      );
      expect((await writeOff(-30000, { exception: "ex-force" }) as { message: string }).message).toMatch(
        /does not license a single release/
      );
    });

    it("leaves a tenant with no policy row untouched", async () => {
      // Ridgeview has entries above every threshold in the ledger tests and no policy: still fine.
      const { rows } = await db.admin.query(
        "SELECT count(*)::int AS n FROM control_policies WHERE tenant_id = $1",
        [ridgeview.id]
      );
      expect(rows[0].n).toBe(0);
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
