import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { setAddress } from "./addresses";
import { readReach } from "./reach";
import { readSetup, type SetupReading } from "./setup";

/**
 * Who the practice was never set up to reach (Increment 1.70).
 *
 * Two rules are worth proving. **The scope is the people who could act on a
 * notice**, so the front desk and the new hire — who between them open six
 * screens and can discharge nothing a notice says — never appear however long
 * they go without an address. And **this reading and Increment 1.69's divide
 * the work at the moment somebody saves an address**: before it, this one
 * names them; after it, that one does, proved or not.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const newhire = DEV_USERS[2]!;
const cpa = DEV_USERS[3]!;
const ownerMailbox = "riley@ridgeview.example";

describe.skipIf(!adminUrl)("who the practice was never set up to reach (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  const asUser = <T,>(userId: string, fn: Parameters<typeof withTenantTransaction<T>>[2]) =>
    withTenantTransaction(tenantId, userId, fn, env);
  /** Nobody signs in to read this; the board and the digest route both do. */
  const asNobody = <T,>(fn: Parameters<typeof withTenantTransaction<T>>[2]) =>
    withTenantTransaction(tenantId, "", fn, env);

  const setupAt = (at: Date) => asNobody((d) => readSetup(d, tenantId, at));

  /** What the reading says about one person, so one case never asserts another's state. */
  const stateOf = (reading: SetupReading, userId: string): "missing" | "withdrawn" | "not reported" =>
    reading.missing.some((p) => p.userId === userId)
      ? "missing"
      : reading.withdrawn.some((p) => p.userId === userId)
        ? "withdrawn"
        : "not reported";
  const rowFor = (reading: SetupReading, userId: string) =>
    reading.missing.find((p) => p.userId === userId) ?? reading.withdrawn.find((p) => p.userId === userId);

  const day = 24 * 60 * 60 * 1000;
  const start = new Date("2026-03-01T00:00:00.000Z");
  const after = (days: number) => new Date(start.getTime() + days * day);

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

  it("names the two people who can act on a notice and have never said where to send it", async () => {
    const reading = await setupAt(after(0));
    expect(stateOf(reading, owner.id)).toBe("missing");
    expect(stateOf(reading, cpa.id)).toBe("missing");
    // The denominator, so a later empty list reads as measured rather than as
    // a read that found nothing.
    expect(reading.expected).toBe(2);
  });

  it("leaves out everybody who could not act on a single notice, which is most of the roster", async () => {
    // The front desk posts payments and imports; the new hire holds nothing.
    // Neither has an address and neither is a fault: an address is theirs to
    // give (Increment 1.58), and the practice needs none to do its own job.
    const reading = await setupAt(after(0));
    expect(stateOf(reading, front.id)).toBe("not reported");
    expect(stateOf(reading, newhire.id)).toBe("not reported");
  });

  it("says what has never happened, and names the accountant's seat as the accountant's", async () => {
    const reading = await setupAt(after(0));
    expect(rowFor(reading, owner.id)!.sentence).toContain(owner.displayName);
    expect(rowFor(reading, owner.id)!.sentence).toContain("never said where");
    expect(rowFor(reading, cpa.id)!.seat).toBe("accountant");
    expect(rowFor(reading, cpa.id)!.sentence).toContain("outside accountant's seat");
    // The one thing this product sends outside itself, so its seat reads first.
    expect(reading.missing[0]!.userId).toBe(cpa.id);
  });

  it("hands the person to Increment 1.69 the moment they save an address, proved or not", async () => {
    await asUser(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, ownerMailbox, after(1)));
    const reading = await setupAt(after(2));
    // This reading answers "did they say where", and they have.
    expect(stateOf(reading, owner.id)).toBe("not reported");
    // That one answers "does it work", and it does not: nobody has proved it.
    const reach = await asNobody((d) => readReach(d, tenantId, after(2)));
    expect(reach.unreachable.find((u) => u.userId === owner.id)?.why).toBe("unproved");
  });

  it("keeps the denominator still while the numerator moves", async () => {
    // Saving an address changes who is reported and not who is expected: a
    // denominator that shrank as people were fixed would make the card say
    // less the better the practice got.
    const reading = await setupAt(after(2));
    expect(reading.expected).toBe(2);
    expect(reading.missing.map((p) => p.userId)).toEqual([cpa.id]);
  });

  it("calls a withdrawal a decision rather than an absence, and still says what it costs", async () => {
    await asUser(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, null, after(3)));
    const reading = await setupAt(after(4));
    expect(stateOf(reading, owner.id)).toBe("withdrawn");
    expect(rowFor(reading, owner.id)!.sentence).toContain("their decision");
    // Still counted, because a manager nobody can tell anything is a manager
    // nobody can tell anything, however they got there.
    expect(reading.expected).toBe(2);
  });

  it("carries no address anywhere in the reading", async () => {
    // Where somebody is reachable is theirs (Increment 1.58). This names the
    // person and never the mailbox, and it is read on two screens.
    const reading = await setupAt(after(4));
    expect(JSON.stringify(reading)).not.toContain(ownerMailbox);
    expect(JSON.stringify(reading)).not.toContain("@");
  });

  it("counts nobody who has left, in either list or the denominator", async () => {
    // Increment 1.65 stopped sending to a deactivated account. Somebody the
    // product must not reach is not somebody it was never set up to reach.
    await db.admin.query("UPDATE users SET active = false WHERE id = $1", [cpa.id]);
    const reading = await setupAt(after(5));
    expect(stateOf(reading, cpa.id)).toBe("not reported");
    expect(reading.expected).toBe(1);
    expect(reading.missing).toEqual([]);
  });
});
