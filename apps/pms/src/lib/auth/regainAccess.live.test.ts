import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encryptSecret } from "@pms/db/crypto";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { authorizeCredentials } from "./authorize";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_TENANTS, DEV_USERS } from "./devSeed";
import { hashPassword } from "./password";
import { hashRecoveryCodes } from "./recovery";
import { createPostgresStore } from "./postgresStore";
import {
  approveRecoveryCeremony,
  consumeRecoveryCeremony,
  initiateRecoveryCeremony,
} from "./recoveryCeremony";
import { eligibleAdmins, loadMembers, openCeremonies, regainCandidates } from "./regainAccess";
import { parseRegainRef } from "./regainLink";
import { currentCodeForTest } from "./totp";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";

/**
 * The person already locked out gets back in (Increment 1.77), against a real
 * database.
 *
 * Three things are worth proving here rather than against the memory store.
 * **The clearing is one write against the real columns**: `mfa_secret_enc`,
 * `mfa_pending_secret_enc`, `mfa_enrolled_at` and `recovery_codes_hash` all
 * end up empty, read back from the row rather than from the store's own
 * answer. **The sign-in that follows really is password-only**, through
 * `authorizeCredentials` against Postgres. And **the reading layer counts the
 * practice's own rows**, which is the number the refusal is built on.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const DEV_MFA_KEY = "a".repeat(64);
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const newhire = DEV_USERS[2]!;
const otherTenantId = DEV_TENANTS[1]!.id;
const otherStaffId = "018f2a10-4c3b-7d21-9e44-5f6a7b8c9d0e";
const NEW_PASSWORD = "Regained-password-4.2!";

function loginReq(ip = "203.0.113.9"): Request {
  return new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: { "x-real-ip": ip, "content-type": "application/json", "user-agent": "live-test" },
  });
}

describe.skipIf(!adminUrl)("getting somebody back into their account (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  const now = new Date();
  const totp = (username: string) => currentCodeForTest(username, DEV_MFA_SECRET, now.getTime());

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

    const passwordHash = await hashPassword(DEV_PASSWORD);
    const mfaSecretEnc = JSON.stringify(encryptSecret(DEV_MFA_SECRET, { DEV_MFA_KEY }));
    for (const t of DEV_TENANTS) {
      await db.admin.query("INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())", [
        t.id,
        t.name,
        t.slug,
      ]);
    }
    for (const u of DEV_USERS) {
      /**
       * The seed gives Ridgeview one administrator. Three are made here.
       *
       * Two would not be enough to model the honest case: with only the owner
       * and one other, a recovery *for the owner* would have to be approved by
       * the owner, which `approveRecoveryCeremony` now refuses and which could
       * never happen anyway — somebody locked out cannot sign in to approve
       * anything. So a third takes the second part.
       *
       * The refusal a one-administrator practice meets is proved against the
       * other practice, which keeps its single seeded administrator.
       */
      const role = u.id === front.id || u.id === newhire.id ? "admin" : u.role;
      const enrolled = u.mfaEnrolled || u.id === newhire.id;
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, clinical_role,
                            mfa_secret_enc, mfa_enrolled_at, recovery_codes_hash, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, now(), now())`,
        [
          u.id,
          u.tenantId,
          u.username,
          u.displayName,
          passwordHash,
          role,
          u.clinicalRole,
          enrolled ? mfaSecretEnc : null,
          enrolled ? now : null,
          JSON.stringify(enrolled ? hashRecoveryCodes(["live-code-1", "live-code-2"], DEV_MFA_KEY) : []),
        ]
      );
    }
    // A second person at the other practice, so the refusal there is about the
    // count of administrators rather than about naming yourself.
    await db.admin.query(
      `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, clinical_role,
                          mfa_secret_enc, mfa_enrolled_at, recovery_codes_hash, password_changed_at, created_at)
       VALUES ($1, $2, 'oakridge-front', 'Oakridge Front Desk', $3, 'user', 'unset',
               $4::jsonb, $5, $6, now(), now())`,
      [otherStaffId, otherTenantId, passwordHash, mfaSecretEnc, now, JSON.stringify(hashRecoveryCodes(["live-code-1"], DEV_MFA_KEY))]
    );
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  const asOwner = <T,>(fn: Parameters<typeof withTenantTransaction<T>>[2]) =>
    withTenantTransaction(tenantId, owner.id, fn, env);

  it("counts the administrators who could take a part from the practice's own rows", async () => {
    // First case in the file, and the database is this file's own: the number
    // is the practice as seeded, before any recovery below changes it.
    const members = await asOwner((d) => loadMembers(d, tenantId));
    expect(eligibleAdmins(members)).toBe(3);
    // And the candidate list leaves out the viewer, whom the act refuses.
    expect(regainCandidates(members, owner.id).some((c) => c.userId === owner.id)).toBe(false);
    expect(regainCandidates(members, owner.id).map((c) => c.userId)).toContain(newhire.id);
  });

  it("refuses a practice whose one administrator would have to take both parts", async () => {
    // Oakridge seeds a single administrator, which is what every practice this
    // product can currently produce.
    const otherOwner = DEV_USERS.find((u) => u.tenantId === otherTenantId && u.role === "admin")!;
    const members = await withTenantTransaction(otherTenantId, otherOwner.id, (d) => loadMembers(d, otherTenantId), env);
    expect(eligibleAdmins(members)).toBe(1);

    const store = createPostgresStore(env);
    // Naming a real colleague, so what refuses is the count of administrators
    // rather than the rule against naming yourself.
    const refused = await initiateRecoveryCeremony(
      store,
      (await store.getUserById(otherOwner.id))!,
      otherStaffId,
      totp(otherOwner.username),
      eligibleAdmins(members),
      now,
      env
    );
    expect(refused).toMatchObject({ ok: false, reason: "no_second_admin" });

    const { rows } = await db.admin.query("SELECT count(*)::int AS n FROM recovery_ceremonies WHERE tenant_id = $1", [
      otherTenantId,
    ]);
    // Nothing was written, so nothing sits waiting for an approval that cannot
    // come.
    expect(rows[0].n).toBe(0);
  });

  it("runs the whole way: two administrators, a link, a password, and no second factor left", async () => {
    const store = createPostgresStore(env);

    const started = await initiateRecoveryCeremony(
      store,
      (await store.getUserById(front.id))!,
      owner.id,
      totp(front.username),
      2,
      now,
      env
    );
    if (!started.ok) throw new Error(`expected a ceremony, got ${started.reason}`);

    // Waiting, and the person who started it is told they may not also finish it.
    const mineFor = async (viewerId: string) =>
      (await asOwner((d) => openCeremonies(d, tenantId, viewerId, now))).find((c) => c.id === started.ceremonyId);
    expect(await mineFor(front.id)).toMatchObject({
      targetName: owner.displayName,
      initiatedByName: front.displayName,
      mine: true,
    });
    expect((await mineFor(owner.id))?.mine).toBe(false);

    // The person the recovery is for may not approve it, even where they could
    // still sign in: that pair would be the initiator and the account being
    // taken over rather than two independent administrators.
    expect(
      await approveRecoveryCeremony(
        store,
        (await store.getUserById(owner.id))!,
        started.ceremonyId,
        totp(owner.username),
        now,
        env
      )
    ).toMatchObject({ ok: false, reason: "target_cannot_approve" });

    const approved = await approveRecoveryCeremony(
      store,
      (await store.getUserById(newhire.id))!,
      started.ceremonyId,
      totp(newhire.username),
      now,
      env
    );
    if (!approved.ok) throw new Error(`expected an approval, got ${approved.reason}`);
    // The link the approver hands over is one the page will accept.
    expect(parseRegainRef(approved.resetToken)).not.toBeNull();

    // Approved is no longer waiting: a row a person cannot act on would be a
    // signal that never clears.
    expect(await mineFor(owner.id)).toBeUndefined();

    expect(await consumeRecoveryCeremony(store, approved.resetToken, NEW_PASSWORD, now)).toMatchObject({
      ok: true,
      username: owner.username,
    });

    const { rows } = await db.admin.query(
      `SELECT mfa_secret_enc, mfa_pending_secret_enc, mfa_enrolled_at, recovery_codes_hash
         FROM users WHERE id = $1`,
      [owner.id]
    );
    // Read off the row rather than off the store, so a store that answered
    // tidily over an untidy row would fail here.
    expect(rows[0].mfa_secret_enc).toBeNull();
    expect(rows[0].mfa_pending_secret_enc).toBeNull();
    expect(rows[0].mfa_enrolled_at).toBeNull();
    expect(JSON.parse(rows[0].recovery_codes_hash)).toEqual([]);

    const later = new Date(now.getTime() + 60_000);
    const back = await authorizeCredentials(
      store,
      { username: owner.username, password: NEW_PASSWORD, totp: "" },
      loginReq("203.0.113.20"),
      later,
      env
    );
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    // Which is the whole of the fix: in on the password, and straight to the
    // screen Increment 1.76 built.
    expect(back.user.needsMfaEnrollment).toBe(true);

    const events = await db.admin.query(
      "SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = 'auth.recovery.consumed'",
      [tenantId]
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].payload).toMatchObject({ secondFactorCleared: true });
  });

  it("leaves an expired ceremony out of what is waiting, because nobody can act on it", async () => {
    const store = createPostgresStore(env);
    // The owner's factor is gone by now — the case above removed it — so the
    // second administrator starts this one.
    const started = await initiateRecoveryCeremony(
      store,
      (await store.getUserById(front.id))!,
      newhire.id,
      totp(front.username),
      2,
      now,
      env
    );
    if (!started.ok) throw new Error(`expected a ceremony, got ${started.reason}`);
    // By id rather than by count: earlier cases in this file leave their own
    // rows behind, and a total would assert the order they ran in.
    const listed = async () => (await asOwner((d) => openCeremonies(d, tenantId, owner.id, now))).map((c) => c.id);
    expect(await listed()).toContain(started.ceremonyId);

    await db.admin.query("UPDATE recovery_ceremonies SET expires_at = $1 WHERE id = $2", [
      new Date(now.getTime() - 1000),
      started.ceremonyId,
    ]);
    expect(await listed()).not.toContain(started.ceremonyId);
  });
});
