import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { noticeAddressChallenges, noticeAddressProofs, uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { currentAddress, setAddress } from "./addresses";
import { collectOutstanding } from "./outstanding";
import { hashCode, proveAddress } from "./proof";
import { runNoticeRound } from "./round";
import { sendNotices } from "./send";
import { memoryTransport } from "./transport";

/**
 * An address nobody re-proves (Increment 1.68).
 *
 * The rule worth proving is the trap Increment 1.65 left: once a proof lapsed,
 * the round **stopped asking** — and the only thing that would have told the
 * person to fetch a code was the notices being withheld. The round now keeps
 * asking, monthly and three times, and then lets the address go.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const mailbox = "riley@ridgeview.example";

describe.skipIf(!adminUrl)("an address nobody re-proves (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  /** The round runs with no acting user, exactly as the command line runs it. */
  function asRound<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, "", fn, env);
  }

  const round = (at: Date) =>
    asRound((d) =>
      runNoticeRound(d, {
        tenantId,
        practiceName: "Ridgeview Dental",
        appUrl: "https://app.example",
        transport: memoryTransport(),
        at,
        pause: async () => {},
      })
    );

  /** Codes that actually reached the transport, oldest first. */
  const codesSent = async (): Promise<string[]> =>
    (
      await db.admin.query(
        "SELECT attempted_at FROM notice_sends WHERE tenant_id = $1 AND kind = 'proof_code' AND outcome = 'sent' ORDER BY attempted_at, id",
        [tenantId]
      )
    ).rows.map((r) => (r.attempted_at as Date).toISOString());

  const sendOwed = (at: Date) =>
    tx(async (d) =>
      sendNotices(d, {
        tenantId,
        recipientId: owner.id,
        recipientName: owner.displayName,
        seat: "owner",
        practiceName: "Ridgeview Dental",
        appUrl: "https://app.example",
        notices: await collectOutstanding(d, tenantId),
        transport: memoryTransport(),
        at,
        pause: async () => {},
      })
    );

  /**
   * A proof dated more than a year ago, written directly.
   *
   * The state under test is "a proof that has lapsed", and the honest way to
   * reach it is a real proof with a real date — not a shortened life, which
   * would test a constant rather than the rule.
   */
  const proveLongAgo = async (provedAt: Date) => {
    const held = await tx((d) => currentAddress(d, tenantId, owner.id));
    const challengeId = uuidv7();
    await tx(async (d) => {
      await d.insert(noticeAddressChallenges).values({
        id: challengeId,
        tenantId,
        userId: owner.id,
        addressId: held!.id,
        tokenHash: hashCode("LONGAGOXYZ"),
        issuedAt: new Date(provedAt.getTime() - 60_000),
        // The proof must fall inside the code's window, which the database checks.
        expiresAt: new Date(provedAt.getTime() + 60_000),
      });
      await d.insert(noticeAddressProofs).values({
        id: uuidv7(),
        tenantId,
        userId: owner.id,
        addressId: held!.id,
        challengeId,
        provedAt,
      });
    });
  };

  const day = 24 * 60 * 60 * 1000;
  /** Proved on this day, so the proof lapses exactly a year later. */
  const provedAt = new Date("2025-01-01T00:00:00.000Z");
  const lapsedAt = new Date("2026-01-01T00:00:00.000Z");
  const after = (days: number) => new Date(lapsedAt.getTime() + days * day);

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
    await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, mailbox, provedAt));
    await proveLongAgo(provedAt);
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("asks again after the proof has lapsed, which the round used not to do", async () => {
    // The regression, and the whole increment: the round stopped here, leaving
    // the person with no way back — the notices that would have told them to
    // fetch a code are the notices being withheld.
    expect(await codesSent()).toHaveLength(0);
    await round(after(4));
    expect(await codesSent()).toEqual([after(4).toISOString()]);
  });

  it("does not ask twice inside a month", async () => {
    // A person who has not answered in a month will not answer faster for
    // being asked more often; past that, asking again is the product talking
    // to itself.
    await round(after(10));
    await round(after(20));
    await round(after(33));
    expect(await codesSent()).toHaveLength(1);
  });

  it("asks once a month, three times in all", async () => {
    await round(after(34));
    expect(await codesSent()).toHaveLength(2);
    await round(after(64));
    expect(await codesSent()).toHaveLength(3);
  });

  it("stops asking once the allowance is spent, and lets the last code have its month", async () => {
    // A code answered on its twenty-ninth day is answered, so the address is
    // let go when that month runs out rather than when the last code leaves.
    await round(after(70));
    await round(after(93));
    expect(await codesSent()).toHaveLength(3);
  });

  it("says the proof lapsed while it is still asking, and names no end that has not come", async () => {
    const result = await sendOwed(after(70));
    expect(result.outcome).toBe("unreachable");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    expect(result.record.detail).toContain("lapsed on 2026-01-01");
    expect(result.record.detail).toContain("Ask for a code and bring it back");
    expect(result.record.detail).not.toContain("stopped being a destination");
  });

  it("says the address stopped being a destination once it is let go", async () => {
    // Three codes at days 4, 34 and 64 after the lapse, each with a month:
    // the last one's month runs out on day 94.
    const result = await sendOwed(after(95));
    expect(result.outcome).toBe("unreachable");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    expect(result.record.detail).toContain("stopped being a destination on 2026-04-05");
    expect(result.record.detail).toContain("3 codes since then went unanswered");
    expect(result.record.detail).toContain("Save an address again");
  });

  it("sends nothing further to a retired address, however many rounds run", async () => {
    await round(after(120));
    await round(after(200));
    await round(after(400));
    expect(await codesSent()).toHaveLength(3);
  });

  it("takes the address back the moment somebody answers one of those codes", async () => {
    // The point of asking again. Nothing about a lapse is a punishment: a code
    // brought back is a fresh proof, and the notices resume.
    const { rows } = await db.admin.query(
      "SELECT body FROM notice_sends WHERE tenant_id = $1 AND kind = 'proof_code' AND outcome = 'sent' ORDER BY attempted_at DESC, id DESC LIMIT 1",
      [tenantId]
    );
    const code = /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(rows[0]!.body as string)?.[1] ?? "";
    expect(code).toHaveLength(10);

    // Brought back inside that code's own day, which is the window the code
    // has; the retirement clock is about the asking, not about the code.
    const proved = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, code, after(64.5)));
    expect(proved.ok).toBe(true);

    const result = await sendOwed(after(65));
    expect(result.outcome).toBe("sent");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    expect(result.record.address).toBe(mailbox);
  });
});
