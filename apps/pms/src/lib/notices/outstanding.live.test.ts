import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { lastCompleteMonth } from "../controls/attestationCoverage";
import { attestChannelMonth } from "../controls/attestations";
import { askAboutLine, replyToThread } from "../cpa/questions";
import { markThreadRead } from "../cpa/threadReads";
import { collectOutstanding } from "./outstanding";

/**
 * What each seat owes, folded from rows (Increment 1.57).
 *
 * The list is derived on every read and stored nowhere, so the thing to prove
 * is that each entry appears exactly while its own fact holds and goes when the
 * fact goes — which a stored notice could not guarantee.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const accountant = DEV_USERS.find((u) => u.username === "ridgeview-cpa")!;
const asOwner = { id: owner.id, name: owner.displayName };
const asAccountant = { id: accountant.id, name: accountant.displayName };
const today = new Date().toISOString().slice(0, 10);
const month = lastCompleteMonth(today);
const thisMonth = today.slice(0, 7);
const LINE = "journal|total";

describe.skipIf(!adminUrl)("what each seat owes (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  let threadId = "";

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  const keys = async () => (await tx((d) => collectOutstanding(d, tenantId))).map((n) => n.key);

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

  it("opens with the practice owing the month that nobody vouched for", async () => {
    const notices = await tx((d) => collectOutstanding(d, tenantId));
    const attestation = notices.find((n) => n.key === `attestation:${month}`);
    expect(attestation).toBeDefined();
    expect(attestation!.seat).toBe("owner");
    // The sentence the owner board and the month-end tie-out already carry,
    // not a second wording for one fact.
    expect(attestation!.sentence).toContain(`Nobody has reviewed new vendors and payroll for ${month}`);
  });

  it("adds a question to the practice's side, and moves it to the accountant's once answered", async () => {
    const asked = await tx((d) =>
      askAboutLine(d, {
        tenantId,
        actor: asAccountant,
        seat: "accountant",
        month: thisMonth,
        subjectKey: LINE,
        body: "The journal total sits under the deposits for this month. What am I missing?",
      })
    );
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    threadId = asked.thread.id;
    expect(await keys()).toContain(`question:${threadId}`);
    expect(await keys()).not.toContain(`unread:${threadId}`);

    const answered = await tx((d) =>
      replyToThread(d, {
        tenantId,
        actor: asOwner,
        seat: "practice",
        threadId,
        body: "Two visits were billed in the following month; nothing is missing from this one.",
      })
    );
    expect(answered.ok).toBe(true);

    // One fact, one seat at a time: answering moves the debt rather than
    // leaving it on both sides or on neither.
    const after = await tx((d) => collectOutstanding(d, tenantId));
    expect(after.map((n) => n.key)).not.toContain(`question:${threadId}`);
    const unread = after.find((n) => n.key === `unread:${threadId}`);
    expect(unread).toBeDefined();
    expect(unread!.seat).toBe("accountant");
    expect(unread!.sentence).toContain("Two visits were billed in the following month");
  });

  it("drops the entry when the fact goes, which is what deriving rather than storing buys", async () => {
    expect((await tx((d) => markThreadRead(d, { tenantId, actor: asAccountant, seat: "accountant", threadId }))).ok).toBe(true);
    expect(await keys()).not.toContain(`unread:${threadId}`);

    for (const channel of ["vendor_new", "payroll"]) {
      const made = await tx((d) =>
        attestChannelMonth(d, {
          tenantId,
          actor: asAccountant,
          seat: "accountant",
          month,
          channel,
          note: `Reviewed ${channel} for the month against the source the practice does not hold.`,
        })
      );
      expect(made.ok).toBe(true);
    }
    expect(await keys()).not.toContain(`attestation:${month}`);
  });

  it("says nothing at all once nothing is owed, which is a real state", async () => {
    // The seeded practice carries no overdue decision, so with the month
    // covered and the thread read the list is genuinely empty rather than
    // quietly holding a stale row.
    expect(await tx((d) => collectOutstanding(d, tenantId))).toEqual([]);
  });
});
