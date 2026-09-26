import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { noticeAddressChallenges, noticeAddressProofs, noticeSends, uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { currentAddress, setAddress } from "./addresses";
import { hashCode, proveAddress, sendProofCode } from "./proof";
import { readReach, type ReachProblem, type ReachReading } from "./reach";
import { hashStop } from "./stop";
import { refuseAddress } from "./stop";
import { memoryTransport } from "./transport";

/**
 * Who the practice believes it is notifying, and is not (Increment 1.69).
 *
 * The rule worth proving is that the reading is honest in both directions: it
 * reports every way an address on file can fail to reach somebody, and it
 * reports nobody whose silence is a decision or a rule rather than a fault.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const ownerMailbox = "riley@ridgeview.example";
const frontMailbox = "finn@ridgeview.example";

describe.skipIf(!adminUrl)("who the practice cannot reach (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  const asUser = <T,>(userId: string, fn: Parameters<typeof withTenantTransaction<T>>[2]) =>
    withTenantTransaction(tenantId, userId, fn, env);
  /** Nobody signs in to refuse, and the round acts for nobody either. */
  const asNobody = <T,>(fn: Parameters<typeof withTenantTransaction<T>>[2]) =>
    withTenantTransaction(tenantId, "", fn, env);

  const reachAt = (at: Date) => asNobody((d) => readReach(d, tenantId, at));

  /** What the reading says about one person, so one case never asserts another's state. */
  const whyFor = (reading: ReachReading, userId: string): ReachProblem | "reachable" =>
    reading.unreachable.find((u) => u.userId === userId)?.why ?? "reachable";
  const rowFor = (reading: ReachReading, userId: string) => reading.unreachable.find((u) => u.userId === userId);

  const day = 24 * 60 * 60 * 1000;
  const provedLongAgo = new Date("2025-01-01T00:00:00.000Z");
  const lapsedAt = new Date("2026-01-01T00:00:00.000Z");
  const after = (days: number) => new Date(lapsedAt.getTime() + days * day);

  /** A real proof with a real date, so the state under test is reached honestly. */
  const plantProof = async (userId: string, provedAt: Date) => {
    const held = await asUser(userId, (d) => currentAddress(d, tenantId, userId));
    const challengeId = uuidv7();
    await asUser(userId, async (d) => {
      await d.insert(noticeAddressChallenges).values({
        id: challengeId,
        tenantId,
        userId,
        addressId: held!.id,
        tokenHash: hashCode("PLANTEDXYZ"),
        issuedAt: new Date(provedAt.getTime() - 60_000),
        expiresAt: new Date(provedAt.getTime() + 60_000),
      });
      await d.insert(noticeAddressProofs).values({
        id: uuidv7(),
        tenantId,
        userId,
        addressId: held!.id,
        challengeId,
        provedAt,
      });
    });
  };

  /** A code that reached the transport, which is what the allowance counts. */
  const plantSentCode = (userId: string, name: string, at: Date) =>
    asNobody((d) =>
      d.insert(noticeSends).values({
        id: uuidv7(),
        tenantId,
        seat: "owner",
        recipientId: userId,
        recipientName: name,
        address: frontMailbox,
        outcome: "sent",
        detail: null,
        failureKind: null,
        kind: "proof_code",
        subject: "Ridgeview Dental: confirm where your messages go",
        body: "Your code is PLANTEDXYZ",
        noticeCount: 0,
        attemptedAt: at,
      })
    );

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

  it("says nobody is unreachable before anybody has said where to send", async () => {
    // An empty reading is measured, not missing: `considered` is what makes a
    // zero mean "nobody to reach" rather than "this read found nothing".
    const reading = await reachAt(after(0));
    expect(reading.considered).toBe(0);
    expect(reading.unreachable).toEqual([]);
  });

  it("names somebody whose address nobody has proved, and says when they saved it", async () => {
    await asUser(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, ownerMailbox, after(0)));
    const reading = await reachAt(after(1));
    expect(reading.considered).toBe(1);
    expect(whyFor(reading, owner.id)).toBe("unproved");
    expect(rowFor(reading, owner.id)!.sentence).toContain("Nobody has proved");
    expect(rowFor(reading, owner.id)!.sentence).toContain(after(0).toISOString().slice(0, 10));
  });

  it("drops them the moment the address is proved", async () => {
    const transport = memoryTransport();
    await asUser(owner.id, (d) =>
      sendProofCode(d, {
        tenantId,
        userId: owner.id,
        userName: owner.displayName,
        seat: "owner",
        practiceName: "Ridgeview Dental",
        appUrl: "https://app.example",
        transport,
        at: after(1),
        pause: async () => {},
      })
    );
    const code = /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(transport.sent[0]!.message.body)?.[1] ?? "";
    const proved = await asUser(owner.id, (d) => proveAddress(d, tenantId, owner.id, owner.displayName, code, after(1)));
    expect(proved.ok).toBe(true);

    const reading = await reachAt(after(2));
    expect(reading.considered).toBe(1);
    expect(whyFor(reading, owner.id)).toBe("reachable");
  });

  it("names a lapsed proof the practice is still chasing, and when it will stop", async () => {
    await asUser(front.id, (d) => setAddress(d, tenantId, front.id, front.displayName, frontMailbox, provedLongAgo));
    await plantProof(front.id, provedLongAgo);

    const reading = await reachAt(after(10));
    expect(reading.considered).toBe(2);
    expect(whyFor(reading, front.id)).toBe("lapsed");
    const row = rowFor(reading, front.id)!;
    expect(row.since.slice(0, 10)).toBe("2026-01-01");
    expect(row.sentence).toContain("still asking");
    expect(row.sentence).toContain("stops on");
    expect(row.seat).toBe("owner");
  });

  it("names a retired address once the codes have run out, with how many went unanswered", async () => {
    // Three codes a month apart, each given its month: the third one's month
    // runs out on day 94, which is when the address is let go.
    for (const d of [4, 34, 64]) await plantSentCode(front.id, front.displayName, after(d));

    const stillChasing = await reachAt(after(70));
    expect(whyFor(stillChasing, front.id)).toBe("lapsed");

    const reading = await reachAt(after(95));
    expect(whyFor(reading, front.id)).toBe("retired");
    const row = rowFor(reading, front.id)!;
    expect(row.since.slice(0, 10)).toBe("2026-04-05");
    expect(row.sentence).toContain("3 codes went unanswered");
  });

  it("puts a refusal above a proof that still stands", async () => {
    // The states rank, and the mailbox's own word is the strongest of them:
    // the owner's proof has not lapsed and is not going to, and the reading
    // still reports the refusal rather than calling them reachable.
    const held = await asUser(owner.id, (d) => currentAddress(d, tenantId, owner.id));
    const secret = "r".repeat(43);
    await asUser(owner.id, (d) =>
      d.insert(noticeAddressChallenges).values({
        id: uuidv7(),
        tenantId,
        userId: owner.id,
        addressId: held!.id,
        tokenHash: hashCode("REFUSEDXYZ"),
        stopHash: hashStop(secret),
        issuedAt: after(100),
        expiresAt: after(101),
      })
    );
    const stopped = await asNobody((d) => refuseAddress(d, tenantId, secret, after(102)));
    expect(stopped.ok).toBe(true);

    const reading = await reachAt(after(103));
    expect(whyFor(reading, owner.id)).toBe("refused");
    expect(rowFor(reading, owner.id)!.sentence).toContain("did not ask for this practice's messages");
  });

  it("names people and never an address, whatever the reason", async () => {
    // Increment 1.58: where somebody is reachable is theirs. The practice needs
    // to know who it cannot reach, not what they typed.
    const reading = await reachAt(after(103));
    expect(reading.unreachable.length).toBeGreaterThan(0);
    const said = JSON.stringify(reading);
    expect(said).not.toContain(ownerMailbox);
    expect(said).not.toContain(frontMailbox);
    for (const u of reading.unreachable) expect(u.name).not.toBe("");
  });

  it("counts nobody who withdrew, because that was a decision and not a fault", async () => {
    await asUser(owner.id, (d) => setAddress(d, tenantId, owner.id, owner.displayName, null, after(104)));
    const reading = await reachAt(after(105));
    expect(whyFor(reading, owner.id)).toBe("reachable");
    expect(reading.unreachable.map((u) => u.userId)).not.toContain(owner.id);
    // And they leave the denominator too: somebody who receives nothing by
    // choice is not somebody the practice is trying to reach.
    expect(reading.considered).toBe(1);
  });

  it("counts nobody who has left the practice, because the product must not reach them", async () => {
    // Increment 1.65 stopped sending to a deactivated account. Filing that as
    // a failure to reach somebody would report a rule working as a fault.
    await db.admin.query("UPDATE users SET active = false WHERE id = $1", [front.id]);
    const reading = await reachAt(after(105));
    expect(reading.considered).toBe(0);
    expect(reading.unreachable).toEqual([]);
  });
});
