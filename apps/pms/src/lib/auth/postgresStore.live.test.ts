import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { encryptSecret } from "@pms/db/crypto";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { verifyDatabaseChains } from "@pms/verifier";
import { authorizeCredentials } from "./authorize";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_TENANTS, DEV_USERS } from "./devSeed";
import { hashPassword } from "./password";
import { createPostgresStore } from "./postgresStore";
import { hashRecoveryCodes } from "./recovery";
import { readRuntimeRole, runtimeRoleErrors } from "../boot/runtimeRole";
import { getPool } from "../db/client";
import { requireAccess } from "./requireAccess";
import { storePorts } from "./storePorts";
import { currentCodeForTest } from "./totp";
import { resetDbPoolForTests } from "../db/client";

/**
 * The Increment 0.2 Postgres store, exercised against a real database as
 * app_rw, with the chain read back as app_verify. Skipped without
 * PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const now = new Date();
const DEV_MFA_KEY = "a".repeat(64);
const owner = DEV_USERS[0];

function loginReq(ip = "203.0.113.9"): Request {
  return new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: { "x-real-ip": ip, "content-type": "application/json", "user-agent": "live-test" },
  });
}

describe.skipIf(!adminUrl)("Postgres auth store (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  let verifier: Client;

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    env = {
      POSTGRES_URL: await db.loginAs("app_rw"),
      APPEND_ROLE_DSN: await db.loginAs("app_append"),
      DEV_MFA_KEY,
      BCRYPT_COST: "4",
      TRUST_PROXY_HEADERS: "auto",
    };
    verifier = new Client({ connectionString: await db.loginAs("app_verify") });
    await verifier.connect();

    const passwordHash = await hashPassword(DEV_PASSWORD);
    const mfaSecretEnc = JSON.stringify(encryptSecret(DEV_MFA_SECRET, { DEV_MFA_KEY }));
    for (const t of DEV_TENANTS) {
      await db.admin.query(
        "INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())",
        [t.id, t.name, t.slug]
      );
    }
    for (const u of DEV_USERS) {
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, clinical_role,
                            mfa_secret_enc, mfa_enrolled_at, recovery_codes_hash, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now(), $9, now(), now())`,
        [
          u.id,
          u.tenantId,
          u.username,
          u.displayName,
          passwordHash,
          u.role,
          u.clinicalRole,
          mfaSecretEnc,
          JSON.stringify(hashRecoveryCodes(["live-code-1"], DEV_MFA_KEY)),
        ]
      );
      for (const entitlement of u.entitlements) {
        await db.admin.query(
          `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
           VALUES (gen_random_uuid(), $1, $2, $3, now())`,
          [u.tenantId, u.id, entitlement]
        );
      }
    }
  }, 60_000);

  afterAll(async () => {
    await verifier?.end();
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("signs in as app_rw, writes a sessions row, and appends auth.signin", async () => {
    const store = createPostgresStore(env);
    const code = currentCodeForTest(owner.username, DEV_MFA_SECRET, now.getTime());
    const result = await authorizeCredentials(
      store,
      { username: owner.username, password: DEV_PASSWORD, totp: code },
      loginReq(),
      now,
      env
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const session = await store.getSession(result.user.sessionId);
    expect(session).toMatchObject({ tenantId: owner.tenantId, userId: owner.id, revokedAt: null });

    const user = await store.getUserByUsername(owner.username);
    expect(user?.entitlements).toEqual(["approve_writeoffs", "run_import", "bank_reconcile"]);

    const { rows } = await db.admin.query(
      "SELECT kind, payload->>'sessionId' AS session_id FROM domain_event WHERE tenant_id = $1",
      [owner.tenantId]
    );
    expect(rows).toEqual([{ kind: "auth.signin", session_id: result.user.sessionId }]);
  });

  it("re-reads the session row on every guarded call and honours revocation", async () => {
    const store = createPostgresStore(env);
    const code = currentCodeForTest(owner.username, DEV_MFA_SECRET, now.getTime());
    const result = await authorizeCredentials(
      store,
      { username: owner.username, password: DEV_PASSWORD, totp: code },
      loginReq(),
      now,
      env
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ports = storePorts(store, async () => result.user.sessionId);
    const req = new Request("http://localhost/api/me", { headers: { origin: "http://localhost" } });
    const before = await requireAccess(req, { minRank: "user" }, ports);
    expect(before.ok).toBe(true);

    await store.deactivateUser(owner.id, new Date(now.getTime() + 1_000));
    const after = await requireAccess(req, { minRank: "user" }, ports);
    expect(after.ok).toBe(false);

    await db.admin.query("UPDATE users SET active = true WHERE id = $1", [owner.id]);
  });

  it("charges a failed attempt to the throttle table with no tenant bound", async () => {
    const store = createPostgresStore(env);
    const result = await authorizeCredentials(
      store,
      { username: DEV_USERS[1].username, password: "wrong-password!", totp: "000000" },
      loginReq("198.51.100.7"),
      now,
      env
    );
    expect(result).toEqual({ ok: false, reason: "credentials" });
    const { rows } = await db.admin.query(
      "SELECT key, fail_count FROM auth_throttle WHERE key LIKE '%198.51.100.7%' ORDER BY key"
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.fail_count === 1)).toBe(true);
  });

  it("the runtime role cannot read another tenant's users even with a bound tenant", async () => {
    const store = createPostgresStore(env);
    const other = await store.getUserByUsername("oakridge-owner");
    expect(other?.tenantId).toBe(DEV_TENANTS[1].id);
    const { rows } = await db.admin.query("SELECT count(*)::int AS n FROM users");
    expect(rows[0].n).toBe(DEV_USERS.length);
  });

  it("the verifier accepts the live chain and refuses a planted tamper", async () => {
    const intact = await verifyDatabaseChains(verifier);
    expect(intact.publish).toBe(true);
    expect(intact.events).toBeGreaterThanOrEqual(2);

    const { rows } = await db.admin.query(
      "SELECT id FROM domain_event WHERE tenant_id = $1 ORDER BY occurred_at LIMIT 1",
      [owner.tenantId]
    );
    await db.admin.query("UPDATE domain_event SET payload = payload || '{\"planted\":true}' WHERE id = $1", [
      rows[0].id,
    ]);

    const tampered = await verifyDatabaseChains(verifier);
    expect(tampered.publish).toBe(false);
    const ridgeview = tampered.tenants.find((t) => t.tenantId === owner.tenantId)!;
    expect(ridgeview.objections.map((o) => o.stepId)).toContain("hash-agrees");
  });

  it("concurrent appends for one tenant serialize into a dense chain with no lost event", async () => {
    const store = createPostgresStore(env);
    const tenant = DEV_TENANTS[1];
    const at = new Date();
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        store.appendDomainEvent({
          tenantId: tenant.id,
          actorUserId: DEV_USERS[2].id,
          kind: "test.concurrent",
          payload: { i },
          at,
        })
      )
    );
    const { rows } = await db.admin.query(
      "SELECT seq FROM domain_event WHERE tenant_id = $1 AND kind = 'test.concurrent' ORDER BY seq",
      [tenant.id]
    );
    expect(rows.map((r) => Number(r.seq))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const verdict = await verifyDatabaseChains(verifier);
    expect(verdict.tenants.find((t) => t.tenantId === tenant.id)?.publish).toBe(true);
  });

  it("the boot guard accepts app_rw and refuses the administrator connection", async () => {
    const runtime = await readRuntimeRole(getPool(env));
    expect(runtime).toMatchObject({ superuser: false, bypassRls: false, ownedTables: [] });
    expect(runtimeRoleErrors(runtime)).toEqual([]);

    const admin = await readRuntimeRole(db.admin);
    expect(runtimeRoleErrors(admin).length).toBeGreaterThan(0);
  });

  it("the verifier role sees nothing but domain_event", async () => {
    await expect(verifier.query("SELECT id FROM users")).rejects.toMatchObject({ code: "42501" });
    await expect(verifier.query("SELECT id FROM sessions")).rejects.toMatchObject({ code: "42501" });
  });
});
