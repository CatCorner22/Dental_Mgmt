import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { administrators, changeRank } from "./ranks";
import { loadStaff } from "./staff";

/**
 * The practice can appoint (Increment 1.78).
 *
 * Nothing in this product wrote `users.role` before this, so a practice kept
 * the ranks it was seeded with forever — which is what made Increment 1.75
 * need a governed exception and left Increment 1.77's refusal naming a remedy
 * nobody could take.
 *
 * Three things are worth proving against a real database. **The rank really
 * moves**, read back off the row. **The last administrator cannot be lowered**,
 * because a practice with none could never appoint one, and every route that
 * would fix that needs the rank nobody holds. And **appointing a second
 * administrator makes the recovery ceremony of Increment 1.77 usable**, which
 * is the whole point of the increment and the one claim that ties the two
 * together.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const newhire = DEV_USERS[2]!;

describe.skipIf(!adminUrl)("changing a rank (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  const actor = { id: owner.id, name: owner.displayName };

  async function rankOf(userId: string): Promise<string> {
    const { rows } = await db.admin.query("SELECT role FROM users WHERE id = $1", [userId]);
    return String(rows[0].role);
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

  it("starts from the practice every seed produces: one administrator", async () => {
    // First case in the file, and the database is this file's own, so the
    // number is the practice as seeded rather than as this file left it.
    const staff = await tx((d) => loadStaff(d, tenantId));
    expect(administrators(staff.rows.map((r) => ({ id: r.id, role: r.role, active: r.active })))).toEqual([owner.id]);
  });

  it("refuses an administrator changing their own rank", async () => {
    const refused = await tx((d) =>
      changeRank(d, { tenantId, actor, targetUserId: owner.id, rank: "manager" })
    );
    expect(refused).toMatchObject({ ok: false, code: "self_rank_change", status: 403 });
    expect(await rankOf(owner.id)).toBe("admin");
  });

  it("refuses a rank this product does not have, before anything is read", async () => {
    const refused = await tx((d) =>
      changeRank(d, { tenantId, actor, targetUserId: front.id, rank: "superuser" })
    );
    expect(refused).toMatchObject({ ok: false, code: "unknown_rank", status: 400 });
  });

  it("refuses a change that moves nothing", async () => {
    const refused = await tx((d) =>
      changeRank(d, { tenantId, actor, targetUserId: front.id, rank: front.role })
    );
    expect(refused).toMatchObject({ ok: false, code: "unchanged", status: 409 });
  });

  it("refuses somebody who is not in this practice", async () => {
    const other = DEV_USERS.find((u) => u.tenantId !== tenantId)!;
    const refused = await tx((d) =>
      changeRank(d, { tenantId, actor, targetUserId: other.id, rank: "manager" })
    );
    expect(refused).toMatchObject({ ok: false, code: "target_not_found", status: 404 });
  });

  it("changes the rank, writes it to the row, and says what signing power moved", async () => {
    const result = await tx((d) =>
      changeRank(d, { tenantId, actor, targetUserId: front.id, rank: "admin", reason: "A second pair of hands." })
    );
    if (!result.ok) throw new Error(`expected the change, got ${result.code}`);
    expect(result).toMatchObject({ fromRank: front.role, toRank: "admin" });
    expect(await rankOf(front.id)).toBe("admin");

    // A promotion to administrator makes somebody "Owner / Dentist" to the
    // release rules, which is what the practice is told rather than a
    // segregation-of-duties refusal that the rulebook would never raise.
    expect(result.shift.gainedSecond.length).toBeGreaterThan(0);

    const events = await db.admin.query(
      "SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = 'role.rank_changed'",
      [tenantId]
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].payload).toMatchObject({ userId: front.id, fromRank: front.role, toRank: "admin" });
  });

  it("makes the Increment 1.77 recovery ceremony usable, which is the point of the increment", async () => {
    const staff = await tx((d) => loadStaff(d, tenantId));
    const admins = administrators(staff.rows.map((r) => ({ id: r.id, role: r.role, active: r.active })));
    // Two, so `initiateRecoveryCeremony` no longer refuses with
    // `no_second_admin` and Increment 1.77's "Appoint a second administrator"
    // is an instruction this product can obey.
    expect(admins).toHaveLength(2);
    expect(admins).toContain(front.id);
  });

  it("lowers an administrator once the practice has two", async () => {
    const allowed = await tx((d) =>
      changeRank(d, { tenantId, actor, targetUserId: front.id, rank: "manager" })
    );
    if (!allowed.ok) throw new Error(`expected the change, got ${allowed.code}`);
    expect(await rankOf(front.id)).toBe("manager");
    // What the practice gives up is said as plainly as what it gained.
    expect(allowed.shift.lostSecond.length).toBeGreaterThan(0);
  });

  /**
   * The last-administrator refusal cannot be reached through the route, and
   * that is the point rather than a gap: the route is `minRank: "admin"` and
   * `self_rank_change` refuses an actor who is the target, so anybody lowering
   * an administrator is a *second* administrator and the count is never one.
   * The invariant is held by that refusal; this is the net under it, for the
   * day something else can lower or deactivate an administrator.
   *
   * So the rule is exercised where it lives — on the function — rather than
   * through a path that cannot produce the state. A case that drove the route
   * would pass on the wrong refusal and prove nothing.
   */
  it("refuses lowering the last administrator, checked on the function that holds the rule", async () => {
    const staff = await tx((d) => loadStaff(d, tenantId));
    expect(administrators(staff.rows.map((r) => ({ id: r.id, role: r.role, active: r.active })))).toEqual([owner.id]);

    const refused = await tx((d) =>
      changeRank(d, {
        tenantId,
        actor: { id: front.id, name: front.displayName },
        targetUserId: owner.id,
        rank: "manager",
      })
    );
    expect(refused).toMatchObject({ ok: false, code: "last_administrator", status: 409 });
    expect(await rankOf(owner.id)).toBe("admin");
    if (refused.ok) return;
    expect(refused.nextSteps[0]).toContain("Make somebody else an administrator first");
  });

  it("appoints again afterwards, so the refusal above bounds nothing permanently", async () => {
    const again = await tx((d) =>
      changeRank(d, { tenantId, actor, targetUserId: newhire.id, rank: "admin" })
    );
    expect(again.ok).toBe(true);
    expect(await rankOf(newhire.id)).toBe("admin");
  });
});
