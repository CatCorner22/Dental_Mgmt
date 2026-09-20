import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { domainEvent, users } from "@pms/db";
import { and, eq } from "drizzle-orm";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { readSetup } from "../notices/setup";
import { claimSeat, inviteAccountant, lookUpInvite, reinviteSeat, unclaimedInvitations } from "./invite";
import { verifyPassword } from "./password";

/**
 * The practice invites the seat it cannot otherwise create (Increment 1.71).
 *
 * Two rules are worth proving. **The practice never learns the secret**: the
 * account it opens is closed to every value this test can name until its
 * holder sets one, and the invitation link does not open it either. And **the
 * invitation is spent once**: a second claim refuses, while a claim refused
 * for a weak password leaves the invitation unspent.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const otherTenantId = DEV_TENANTS[1]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;

describe.skipIf(!adminUrl)("inviting the outside accountant's seat (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  const asUser = <T,>(userId: string, fn: Parameters<typeof withTenantTransaction<T>>[2]) =>
    withTenantTransaction(tenantId, userId, fn, env);
  /** Nobody is signed in while a seat is claimed: that is the whole point of the act. */
  const asNobody = <T,>(fn: Parameters<typeof withTenantTransaction<T>>[2]) =>
    withTenantTransaction(tenantId, "", fn, env);

  const at = new Date("2026-04-01T09:00:00.000Z");
  const later = (days: number) => new Date(at.getTime() + days * 24 * 60 * 60 * 1000);

  let invited: { userId: string; secret: string };

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

  it("creates the seat at the lowest rank with the one grant that opens the month-end screen", async () => {
    const result = await asUser(owner.id, (d) =>
      inviteAccountant(d, tenantId, { id: owner.id, name: owner.displayName }, { username: "firm-accounting", displayName: "Prentice & Co" }, at)
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    invited = { userId: result.seat.userId, secret: result.seat.secret };

    const row = (
      await asUser(owner.id, (d) =>
        d.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.id, result.seat.userId))).limit(1)
      )
    )[0];
    expect(row!.role).toBe("readonly");
    expect(row!.active).toBe(true);
    // No second factor yet: the existing sign-in takes a user without one
    // through enrolment, which is the same path every other account uses.
    expect(row!.mfaEnrolledAt).toBeNull();
  });

  it("opens an account no secret this practice holds can sign into", async () => {
    const row = (
      await asUser(owner.id, (d) =>
        d.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.id, invited.userId))).limit(1)
      )
    )[0];
    // Not the invitation secret, and not the username: the row carries a hash
    // of bytes nobody kept, so "the practice never learns it" is a property of
    // the rows rather than a promise about the code.
    expect(await verifyPassword(invited.secret, row!.passwordHash)).toBe(false);
    expect(await verifyPassword("firm-accounting", row!.passwordHash)).toBe(false);
  });

  it("hands Increment 1.70's reading a seat that has never said where to send its messages", async () => {
    // The through-line: 1.70 reported an accountant who was never set up, and
    // a practice without one had no way to reach even that state.
    const reading = await asNobody((d) => readSetup(d, tenantId, later(0)));
    const mine = reading.missing.find((p) => p.userId === invited.userId);
    expect(mine?.seat).toBe("accountant");
    expect(mine?.sentence).toContain("never said where");
  });

  it("refuses a username somebody already signs in with, in words rather than as a constraint", async () => {
    const result = await asUser(owner.id, (d) =>
      inviteAccountant(d, tenantId, { id: owner.id, name: owner.displayName }, { username: front.username, displayName: "Somebody Else" }, at)
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("taken");
    expect(result.status).toBe(409);
    expect(result.why).toContain(front.username);
  });

  it("refuses a username that would make 'the same username' a question with two answers", async () => {
    const result = await asUser(owner.id, (d) =>
      inviteAccountant(d, tenantId, { id: owner.id, name: owner.displayName }, { username: "Firm Accounting", displayName: "Prentice & Co" }, at)
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("malformed");
  });

  it("answers an unknown secret and another practice's secret in the same words", async () => {
    const unknown = await asNobody((d) => lookUpInvite(d, tenantId, "z".repeat(43), later(0)));
    const elsewhere = await withTenantTransaction(
      otherTenantId,
      "",
      (d) => lookUpInvite(d, otherTenantId, invited.secret, later(0)),
      env
    );
    expect(unknown.ok).toBe(false);
    expect(elsewhere.ok).toBe(false);
    if (unknown.ok || elsewhere.ok) return;
    expect(unknown.why).toBe(elsewhere.why);
    expect(unknown.status).toBe(404);
  });

  it("leaves the invitation unspent when the password is refused", async () => {
    const weak = await asNobody((d) => claimSeat(d, tenantId, invited.secret, "short", later(1)));
    expect(weak.ok).toBe(false);
    if (weak.ok) return;
    expect(weak.code).toBe("weak");
    // Still claimable, which is the point: a rejected password must not cost
    // somebody their one link.
    const still = await asNobody((d) => lookUpInvite(d, tenantId, invited.secret, later(1)));
    expect(still.ok).toBe(true);
  });

  it("sets the password the practice never learns, and spends the link once", async () => {
    const claimed = await asNobody((d) => claimSeat(d, tenantId, invited.secret, "a-long-enough-password", later(1)));
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.username).toBe("firm-accounting");

    const row = (
      await asUser(owner.id, (d) =>
        d.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.id, invited.userId))).limit(1)
      )
    )[0];
    expect(await verifyPassword("a-long-enough-password", row!.passwordHash)).toBe(true);

    const again = await asNobody((d) => claimSeat(d, tenantId, invited.secret, "another-long-password", later(1)));
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.code).toBe("claimed");
  });

  it("drops a claimed seat from the list of invitations nobody has used", async () => {
    const open = await asUser(owner.id, (d) => unclaimedInvitations(d, tenantId));
    expect(open.map((i) => i.userId)).not.toContain(invited.userId);
  });

  it("records both acts in the chain, naming the practice's actor and then the seat's own", async () => {
    const events = await asUser(owner.id, (d) =>
      d.select({ kind: domainEvent.kind, actor: domainEvent.actorUserId }).from(domainEvent).where(eq(domainEvent.tenantId, tenantId))
    );
    const invitedEvent = events.find((e) => e.kind === "seat.invited");
    const claimedEvent = events.find((e) => e.kind === "seat.claimed");
    expect(invitedEvent?.actor).toBe(owner.id);
    // The claim is the invited person's act, not a stranger's: unlike a
    // refusal (Increment 1.67) there is somebody to name, so it is named.
    expect(claimedEvent?.actor).toBe(invited.userId);
  });

  it("refuses an invitation that records somebody else as the inviter", async () => {
    // The acting-user rule, which is Increment 1.58's read the other way: there
    // nobody may act for another person, here nobody may record another person
    // as having acted. Set `app.user_id` first, or the row is refused for
    // having no acting user at all and the case proves the wrong rule.
    await db.admin.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
    await db.admin.query("SELECT set_config('app.user_id', $1, false)", [owner.id]);
    await expect(
      db.admin.query(
        `INSERT INTO seat_invitations (id, tenant_id, user_id, token_hash, invited_by, invited_at, expires_at)
         VALUES (gen_random_uuid(), $1, $2, repeat('b', 64), $3, now(), now() + interval '1 day')`,
        [tenantId, front.id, front.id]
      )
    ).rejects.toThrow(/may not record/);
    await db.admin.query("SELECT set_config('app.user_id', '', false)");
  });

  it("refuses to change an invitation, because a claim is what spends one", async () => {
    await expect(
      db.admin.query("UPDATE seat_invitations SET token_hash = repeat('c', 64)")
    ).rejects.toThrow(/append-only/);
  });

  it("hands a seat whose link went astray another one, keeping the seat itself untouched", async () => {
    // Increment 1.73. Until now `inviteAccountant` had one exit that created
    // anything and it always created a NEW user, so a lost link stranded the
    // account: active, holding the grant, openable by nobody, and named on
    // Increment 1.70's card forever.
    const first = await asUser(owner.id, (d) =>
      inviteAccountant(d, tenantId, { id: owner.id, name: owner.displayName }, { username: "firm-lost", displayName: "Lost & Co" }, at)
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const again = await asUser(owner.id, (d) =>
      reinviteSeat(d, tenantId, { id: owner.id, name: owner.displayName }, first.seat.userId, later(1))
    );
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    // The same person, the same username: the practice already decided all of
    // that and none of it went wrong.
    expect(again.seat.userId).toBe(first.seat.userId);
    expect(again.seat.username).toBe("firm-lost");
    expect(again.seat.secret).not.toBe(first.seat.secret);

    const fresh = await asNobody((d) => lookUpInvite(d, tenantId, again.seat.secret, later(1)));
    expect(fresh.ok).toBe(true);
  });

  it("stops the older link working, by the read rather than by a flag", async () => {
    const seat = await asUser(owner.id, (d) =>
      inviteAccountant(d, tenantId, { id: owner.id, name: owner.displayName }, { username: "firm-stale", displayName: "Stale & Co" }, at)
    );
    expect(seat.ok).toBe(true);
    if (!seat.ok) return;
    // It works before the replacement, which is what makes the refusal after
    // it mean something.
    expect((await asNobody((d) => lookUpInvite(d, tenantId, seat.seat.secret, later(1)))).ok).toBe(true);

    await asUser(owner.id, (d) =>
      reinviteSeat(d, tenantId, { id: owner.id, name: owner.displayName }, seat.seat.userId, later(1))
    );

    const stale = await asNobody((d) => lookUpInvite(d, tenantId, seat.seat.secret, later(1)));
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.code).toBe("superseded");
    // And it cannot open the account either: the claim re-looks-up rather than
    // trusting what a page was rendered with.
    const opened = await asNobody((d) => claimSeat(d, tenantId, seat.seat.secret, "a-long-enough-password", later(1)));
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.code).toBe("superseded");
  });

  it("offers the practice one live link per seat, however many it has sent", async () => {
    const seat = await asUser(owner.id, (d) =>
      inviteAccountant(d, tenantId, { id: owner.id, name: owner.displayName }, { username: "firm-thrice", displayName: "Thrice & Co" }, at)
    );
    expect(seat.ok).toBe(true);
    if (!seat.ok) return;
    await asUser(owner.id, (d) => reinviteSeat(d, tenantId, { id: owner.id, name: owner.displayName }, seat.seat.userId, later(1)));
    await asUser(owner.id, (d) => reinviteSeat(d, tenantId, { id: owner.id, name: owner.displayName }, seat.seat.userId, later(2)));

    const open = await asUser(owner.id, (d) => unclaimedInvitations(d, tenantId));
    // Three unclaimed rows, one seat: listing all three would offer the
    // practice three links of which two open nothing.
    expect(open.filter((i) => i.userId === seat.seat.userId)).toHaveLength(1);
  });

  it("refuses to reissue for a seat that has already been opened", async () => {
    const seat = await asUser(owner.id, (d) =>
      inviteAccountant(d, tenantId, { id: owner.id, name: owner.displayName }, { username: "firm-opened", displayName: "Opened & Co" }, at)
    );
    expect(seat.ok).toBe(true);
    if (!seat.ok) return;
    const claimed = await asNobody((d) => claimSeat(d, tenantId, seat.seat.secret, "a-long-enough-password", later(1)));
    expect(claimed.ok).toBe(true);

    const refused = await asUser(owner.id, (d) =>
      reinviteSeat(d, tenantId, { id: owner.id, name: owner.displayName }, seat.seat.userId, later(2))
    );
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    // Somebody who cannot sign in needs their password recovered, not a link
    // that would let whoever holds it set one.
    expect(refused.code).toBe("claimed");
    expect(refused.why).toContain("recovered");
  });

  it("refuses to reissue for somebody who was never an invited seat", async () => {
    // The owner has a password of their own. A link that let its holder set
    // one would be the practice handing out an account it does not own.
    const refused = await asUser(owner.id, (d) =>
      reinviteSeat(d, tenantId, { id: owner.id, name: owner.displayName }, front.id, later(1))
    );
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.code).toBe("not_a_seat");
    expect(refused.status).toBe(404);
  });

  it("records the reissue in the chain, naming what it replaced", async () => {
    const events = await asUser(owner.id, (d) =>
      d.select({ kind: domainEvent.kind, actor: domainEvent.actorUserId }).from(domainEvent).where(eq(domainEvent.tenantId, tenantId))
    );
    const reissued = events.filter((e) => e.kind === "seat.reinvited");
    expect(reissued.length).toBeGreaterThan(0);
    expect(reissued.every((e) => e.actor === owner.id)).toBe(true);
  });

  it("refuses a link whose week has run out", async () => {
    const fresh = await asUser(owner.id, (d) =>
      inviteAccountant(d, tenantId, { id: owner.id, name: owner.displayName }, { username: "firm-later", displayName: "Later & Co" }, at)
    );
    expect(fresh.ok).toBe(true);
    if (!fresh.ok) return;
    const stale = await asNobody((d) => lookUpInvite(d, tenantId, fresh.seat.secret, later(8)));
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.code).toBe("expired");
  });
});
