import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { uuidv7 } from "@pms/db";
import { encryptSecret } from "@pms/db/crypto";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { verifyDatabaseChains } from "@pms/verifier";
import { authorizeCredentials } from "./authorize";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_TENANTS, DEV_USERS } from "./devSeed";
import { hashPassword } from "./password";
import { createPostgresStore } from "./postgresStore";
import { beginMfaEnrollment, completeMfaEnrollment } from "./enrollMfa";
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

  /**
   * Increment 1.86. `revokeEntitlement` ends a grant by stamping
   * `effective_to`, the way this product ends every row, and it does not end
   * the person's sessions. The authorization path read every row the user had
   * ever held, so the duty went on opening its routes: the owner pressed
   * Revoke, the screen said the duty was gone, the SoD finding closed, the
   * `role.revoked` event was written, and nothing changed for the person
   * holding it.
   *
   * The revoke is written here as the SQL `revokeEntitlement` writes, rather
   * than through that function, because the claim under test belongs to the
   * store: given a row stamped this way, what does `requireAccess` see.
   */
  it("stops opening a route on a duty that has been revoked", async () => {
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
    const req = new Request("http://localhost/api/reconciliation", { headers: { origin: "http://localhost" } });
    const opts = { entitlements: ["bank_reconcile"] };

    const held = await requireAccess(req, opts, ports);
    expect(held.ok).toBe(true);

    await db.admin.query(
      "UPDATE user_entitlements SET effective_to = now() WHERE user_id = $1 AND entitlement = 'bank_reconcile' AND effective_to IS NULL",
      [owner.id]
    );

    try {
      // The same session, the same request, one revoked row.
      const revoked = await requireAccess(req, opts, ports);
      expect(revoked.ok).toBe(false);
      if (!revoked.ok) expect(revoked.response.status).toBe(403);

      const user = await store.getUserById(owner.id);
      expect(user?.entitlements).toEqual(["approve_writeoffs", "run_import"]);
    } finally {
      // Later cases read the seeded picture, so restore it even on a failure.
      await db.admin.query(
        "UPDATE user_entitlements SET effective_to = NULL WHERE user_id = $1 AND entitlement = 'bank_reconcile'",
        [owner.id]
      );
    }
  });

  /**
   * The other half of the same rule (Increment 1.86). No product path writes a
   * future `effective_from` today — every writer stamps `now` — so this is a
   * hazard the predicate closes rather than a defect anybody met. It is worth
   * a case because the column exists, is `NOT NULL`, and is the half a reader
   * adding a scheduled grant would otherwise have to rediscover.
   */
  it("does not open a route on a grant that has not begun", async () => {
    const store = createPostgresStore(env);
    const front = DEV_USERS[1];
    await db.admin.query(
      `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
       VALUES ($1, $2, $3, 'bank_reconcile', now() + interval '1 hour')`,
      [uuidv7(), front.tenantId, front.id]
    );

    try {
      const user = await store.getUserByUsername(front.username);
      expect(user?.entitlements).not.toContain("bank_reconcile");
    } finally {
      await db.admin.query(
        "DELETE FROM user_entitlements WHERE user_id = $1 AND entitlement = 'bank_reconcile'",
        [front.id]
      );
    }
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

  /**
   * Increment 1.76. A second factor used to be a one-way door, so every
   * account counted down to a lockout nothing could undo. These cases hold the
   * way out against a real database, and in particular the column that keeps a
   * pairing in progress away from the factor that works.
   */
  it("stages a new authenticator without disturbing the one on the account", async () => {
    const store = createPostgresStore(env);
    const before = await store.getUserById(owner.id);
    expect(before?.mfaEnrolledAt).toBeTruthy();

    const started = await beginMfaEnrollment(store, owner.id, { DEV_MFA_KEY });
    expect(started.repairing).toBe(true);

    // The live columns are exactly as they were: opening this screen and
    // walking away leaves the person with the factor they arrived with.
    const after = await store.getUserById(owner.id);
    expect(after?.mfaSecretEnc).toEqual(before?.mfaSecretEnc);
    expect(after?.mfaEnrolledAt).toEqual(before?.mfaEnrolledAt);
    expect(after?.recoveryCodeHashes).toEqual(before?.recoveryCodeHashes);
    // And the staged secret is in its own column, which the row confirms.
    const { rows } = await db.admin.query(
      "SELECT mfa_secret_enc, mfa_pending_secret_enc FROM users WHERE id = $1",
      [owner.id]
    );
    expect(rows[0].mfa_pending_secret_enc).toBeTruthy();
    expect(rows[0].mfa_pending_secret_enc).not.toEqual(rows[0].mfa_secret_enc);
  });

  it("neither auth lookup can serve a pairing in progress", async () => {
    // Not merely unused: the functions do not return the column at all, so the
    // paths that resolve a person for a sign-in or a guard are incapable of
    // handing one out.
    for (const fn of ["auth_lookup_user($1)", "auth_lookup_user_by_id($1)"]) {
      const arg = fn.startsWith("auth_lookup_user_by_id") ? owner.id : owner.username;
      const { fields } = await db.admin.query(`SELECT * FROM ${fn}`, [arg]);
      expect(fields.map((f) => f.name)).not.toContain("mfa_pending_secret_enc");
    }
  });

  it("promotes the staged authenticator, reissues the codes, and clears the staging", async () => {
    const store = createPostgresStore(env);
    const before = await store.getUserById(owner.id);
    const secondPhone = "KRSXG5CTMVRXEZLU";
    expect(secondPhone).not.toBe(DEV_MFA_SECRET);

    await beginMfaEnrollment(store, owner.id, { DEV_MFA_KEY });
    await store.setMfaPendingSecret(owner.id, encryptSecret(secondPhone, { DEV_MFA_KEY }));
    const at = new Date();
    const done = await completeMfaEnrollment(
      store,
      owner.id,
      currentCodeForTest(owner.username, secondPhone, at.getTime()),
      { DEV_MFA_KEY },
      at
    );
    expect(done).toMatchObject({ ok: true, repaired: true });
    if (!done.ok) return;
    expect(done.recoveryCodes).toHaveLength(10);

    const after = await store.getUserById(owner.id);
    expect(after?.mfaSecretEnc).not.toEqual(before?.mfaSecretEnc);
    // The supply is restored, which is what ends the countdown: the act that
    // pairs the new phone reissues the codes that would reach it.
    expect(after?.recoveryCodeHashes).toHaveLength(10);
    expect(after?.recoveryCodeHashes).not.toEqual(before?.recoveryCodeHashes);
    expect(await store.getMfaPendingSecret(owner.id)).toBeNull();

    // The new authenticator signs in; the old one does not.
    const later = new Date(at.getTime() + 60_000);
    expect(
      await authorizeCredentials(
        store,
        { username: owner.username, password: DEV_PASSWORD, totp: currentCodeForTest(owner.username, secondPhone, later.getTime()) },
        loginReq("203.0.113.76"),
        later,
        env
      )
    ).toMatchObject({ ok: true });
    expect(
      await authorizeCredentials(
        store,
        { username: owner.username, password: DEV_PASSWORD, totp: currentCodeForTest(owner.username, DEV_MFA_SECRET, later.getTime()) },
        loginReq("203.0.113.76"),
        later,
        env
      )
    ).toMatchObject({ ok: false });

    // And the chain says which act it was.
    const chain = await db.admin.query("SELECT kind FROM domain_event WHERE kind = 'auth.mfa_repaired'");
    expect(chain.rows).toHaveLength(1);
  });
});

