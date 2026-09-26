import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { changeRank } from "./ranks";
import { setPersonActive } from "./roster";
import { loadControlsContext } from "./practiceState";

/**
 * Who is still on the practice (Increment 1.79), against a real database.
 *
 * Four things are worth proving here rather than against a memory store.
 * **The column really moves**, read back off the row. **The grants end with
 * the person**, which is what keeps a departed colleague's duty conflicts from
 * standing on Practice Risk forever — `detectSodConflicts` never reads
 * `active`, so nothing else would clear them. **The sessions are revoked in
 * the same transaction**, because `authorize` refuses an inactive account on
 * the next sign-in and a session already minted is not a sign-in. And **the
 * last-administrator refusal fires**, which Increment 1.78 wrote and could not
 * reach: a rank change cannot take the count to one, and a deactivation can.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const newhire = DEV_USERS[2]!;

describe.skipIf(!adminUrl)("standing somebody down and bringing them back (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  const actor = { id: owner.id, name: owner.displayName };

  async function rowOf(userId: string): Promise<{ active: boolean; live: number; sessions: number }> {
    const u = await db.admin.query("SELECT active FROM users WHERE id = $1", [userId]);
    const g = await db.admin.query(
      "SELECT count(*)::int AS n FROM user_entitlements WHERE user_id = $1 AND effective_to IS NULL",
      [userId]
    );
    const s = await db.admin.query(
      "SELECT count(*)::int AS n FROM sessions WHERE user_id = $1 AND revoked_at IS NULL",
      [userId]
    );
    return { active: u.rows[0].active, live: g.rows[0].n, sessions: s.rows[0].n };
  }

  /** Conflicts the SoD report still attributes to this person. */
  async function conflictsFor(userId: string): Promise<number> {
    const ctx = await tx((d) => loadControlsContext(d, tenantId));
    return ctx.built.sod.conflicts.filter((c) => c.personId === userId).length;
  }

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

  it("refuses somebody who is not in this practice", async () => {
    const other = DEV_USERS.find((u) => u.tenantId !== tenantId)!;
    expect(await tx((d) => setPersonActive(d, { tenantId, actor, targetUserId: other.id, active: false }))).toMatchObject(
      { ok: false, code: "target_not_found", status: 404 }
    );
  });

  it("refuses an administrator standing themselves down", async () => {
    // Stronger here than for a rank: this act revokes the sessions, so doing
    // it to yourself would sign you out mid-act.
    expect(await tx((d) => setPersonActive(d, { tenantId, actor, targetUserId: owner.id, active: false }))).toMatchObject(
      { ok: false, code: "self_deactivation", status: 403 }
    );
    expect((await rowOf(owner.id)).active).toBe(true);
  });

  it("refuses bringing back somebody who never left", async () => {
    expect(await tx((d) => setPersonActive(d, { tenantId, actor, targetUserId: front.id, active: true }))).toMatchObject(
      { ok: false, code: "unchanged", status: 409 }
    );
  });

  /**
   * This increment was planned on the belief that a deactivation would reach
   * the refusal a rank change could not: standing an administrator down can
   * take the count to zero, where lowering a rank cannot. **The belief does
   * not survive the guard.** The route is `minRank: "admin"`, so the actor is
   * an active administrator; `self_deactivation` means the target is somebody
   * else; and an administrator target therefore means two administrators. The
   * count is never one.
   *
   * So the rule is exercised where it lives, as Increment 1.78's is. A case
   * driving the route would refuse on `self_deactivation` and prove nothing
   * about this rule at all.
   */
  it("refuses standing down the only administrator, checked on the function that holds the rule", async () => {
    const refused = await tx((d) =>
      setPersonActive(d, {
        tenantId,
        actor: { id: front.id, name: front.displayName },
        targetUserId: owner.id,
        active: false,
      })
    );
    expect(refused).toMatchObject({ ok: false, code: "last_administrator", status: 409 });
    expect((await rowOf(owner.id)).active).toBe(true);
    if (refused.ok) return;
    expect(refused.nextSteps[0]).toContain("Make somebody else an administrator first");
  });

  it("allows standing an administrator down once the practice has two", async () => {
    const second = await tx((d) => changeRank(d, { tenantId, actor, targetUserId: newhire.id, rank: "admin" }));
    expect(second.ok).toBe(true);
    expect(await tx((d) => setPersonActive(d, { tenantId, actor, targetUserId: newhire.id, active: false }))).toMatchObject(
      { ok: true }
    );
    expect((await rowOf(newhire.id)).active).toBe(false);

    // And the owner is the only one left again, so the refusal returns.
    expect(
      await tx((d) =>
        setPersonActive(d, {
          tenantId,
          actor: { id: front.id, name: front.displayName },
          targetUserId: owner.id,
          active: false,
        })
      )
    ).toMatchObject({ ok: false, code: "last_administrator" });

    // Bringing them back bounds the refusal to nothing permanent.
    expect(await tx((d) => setPersonActive(d, { tenantId, actor, targetUserId: newhire.id, active: true }))).toMatchObject(
      { ok: true }
    );
  });

  it("ends every live grant and revokes the sessions, so the SoD view stops naming them", async () => {
    // Finn Front, not the new hire: the seed gives the new hire no
    // entitlements at all, so a case run against that account would assert
    // that zero grants ended and prove nothing about ending any.
    const before = await rowOf(front.id);
    // The seed gives this account grants; without them the case would prove
    // nothing about ending any.
    expect(before.live).toBeGreaterThan(0);
    await db.admin.query(
      `INSERT INTO sessions (id, tenant_id, user_id, device_profile, idle_expires_at, absolute_expires_at, last_seen_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'desk', now() + interval '1 hour', now() + interval '8 hours', now(), now())`,
      [tenantId, front.id]
    );
    expect((await rowOf(front.id)).sessions).toBe(1);

    const done = await tx((d) =>
      setPersonActive(d, { tenantId, actor, targetUserId: front.id, active: false, reason: "Left the practice." })
    );
    if (!done.ok) throw new Error(`expected the change, got ${done.code}`);
    expect(done.endedEntitlements.length).toBe(before.live);

    const after = await rowOf(front.id);
    expect(after).toMatchObject({ active: false, live: 0, sessions: 0 });
    // Which is the whole reason the grants end rather than the column alone:
    // `detectSodConflicts` never reads `active`, so nothing else would clear
    // a departed person's duties.
    expect(await conflictsFor(front.id)).toBe(0);

    const events = await db.admin.query(
      "SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = 'roster.deactivated' AND payload->>'userId' = $2",
      [tenantId, front.id]
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].payload).toMatchObject({ userId: front.id, reason: "Left the practice." });
  });

  it("brings the account back and not the powers, so every grant is decided again", async () => {
    const done = await tx((d) => setPersonActive(d, { tenantId, actor, targetUserId: front.id, active: true }));
    if (!done.ok) throw new Error(`expected the change, got ${done.code}`);
    // Nothing is handed back: a reactivation that restored six entitlements
    // would be a grant nobody decided.
    expect(done.endedEntitlements).toEqual([]);
    expect(await rowOf(front.id)).toMatchObject({ active: true, live: 0 });

    const events = await db.admin.query(
      // Scoped to this person: an earlier case in this file brought somebody
      // else back, and a total would assert the order the file ran in.
      "SELECT count(*)::int AS n FROM domain_event WHERE tenant_id = $1 AND kind = 'roster.reactivated' AND payload->>'userId' = $2",
      [tenantId, front.id]
    );
    expect(events.rows[0].n).toBe(1);
  });

  it("refuses standing down somebody already stood down", async () => {
    await tx((d) => setPersonActive(d, { tenantId, actor, targetUserId: front.id, active: false }));
    expect(
      await tx((d) => setPersonActive(d, { tenantId, actor, targetUserId: front.id, active: false }))
    ).toMatchObject({ ok: false, code: "unchanged", status: 409 });
  });
});
