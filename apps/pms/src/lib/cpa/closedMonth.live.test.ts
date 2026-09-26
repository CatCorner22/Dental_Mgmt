import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { lastCompleteMonth } from "../controls/attestationCoverage";
import { closeMonth } from "./close";
import { askAboutLine, listThreads, replyToThread, threadsAwaitingPractice } from "./questions";

/**
 * A question about a month the practice has since closed (Increment 1.54).
 *
 * Increment 1.50 gave the two sides a thread. Increment 1.36 made a month
 * closable, freezing the package hash and admitting a later correction only
 * under `prior_period`, posted today. A thread read the same either way, and
 * the two call for different answers: "I will fix that figure" is true of an
 * open month and false of a closed one. These cases drive the same thread
 * across the close and assert it changes what it says.
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
// The month that has ended: the only kind a practice may close.
const month = lastCompleteMonth(today);
const thisMonth = today.slice(0, 7);
const LINE = "journal|total";

describe.skipIf(!adminUrl)("a question about a closed month (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  let threadId = "";

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
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

  it("reads null while the month is open, which means open rather than unexamined", async () => {
    const asked = await tx((d) =>
      askAboutLine(d, {
        tenantId,
        actor: asAccountant,
        seat: "accountant",
        month,
        subjectKey: LINE,
        body: "The journal total is lower than I expected for this month. What am I missing?",
      })
    );
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    threadId = asked.thread.id;
    expect(asked.thread.closedMonth).toBeNull();

    const [listed] = await tx((d) => listThreads(d, tenantId, month));
    expect(listed!.closedMonth).toBeNull();
    // And the owner board's own reading agrees, since it resolves the close too.
    const owed = await tx((d) => threadsAwaitingPractice(d, tenantId));
    expect(owed.find((t) => t.id === threadId)!.closedMonth).toBeNull();
  });

  it("says who closed the month, when, and what a fix now does, once the month is closed", async () => {
    const closed = await tx((d) => closeMonth(d, { tenantId, actor: asOwner, month }));
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;

    const [listed] = await tx((d) => listThreads(d, tenantId, month));
    expect(listed!.closedMonth).not.toBeNull();
    expect(listed!.closedMonth!.closedByName).toBe(owner.displayName);
    expect(listed!.closedMonth!.sentence).toBe(
      `${month} was closed by ${owner.displayName} on ${closed.close.closedAt.slice(0, 10)}, so its figures are frozen and the accountant already has them. ` +
        "A correction to this line now posts today with reason prior_period and is reported in the month it posts, not in this one."
    );

    // The owner reads the same words on the board, before answering rather than after.
    const owed = await tx((d) => threadsAwaitingPractice(d, tenantId));
    expect(owed.find((t) => t.id === threadId)!.closedMonth!.sentence).toBe(listed!.closedMonth!.sentence);
  });

  it("carries the note on the thread a reply returns, not only on a later read", async () => {
    // A message written into a closed month says so from the moment it lands.
    const replied = await tx((d) =>
      replyToThread(d, {
        tenantId,
        actor: asOwner,
        seat: "practice",
        threadId,
        body: "Two visits were billed in the following month; nothing is missing from this one.",
      })
    );
    expect(replied.ok).toBe(true);
    if (!replied.ok) return;
    expect(replied.thread.closedMonth).not.toBeNull();
    expect(replied.thread.closedMonth!.month).toBe(month);
    // The thread is answered, so the practice owes nothing and the board drops it.
    expect(replied.thread.awaitingPractice).toBe(false);
    expect((await tx((d) => threadsAwaitingPractice(d, tenantId))).map((t) => t.id)).not.toContain(threadId);
  });

  it("leaves a thread about a month still running unmarked, closed neighbour or not", async () => {
    // The note is the thread's own month, never the practice's latest close.
    const asked = await tx((d) =>
      askAboutLine(d, {
        tenantId,
        actor: asAccountant,
        seat: "accountant",
        month: thisMonth,
        subjectKey: LINE,
        body: "And how is the running month tracking against the one you just closed?",
      })
    );
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    expect(asked.thread.closedMonth).toBeNull();

    const owed = await tx((d) => threadsAwaitingPractice(d, tenantId));
    expect(owed.find((t) => t.id === asked.thread.id)!.closedMonth).toBeNull();
    // The closed month's thread was answered above and has left this list, so
    // the only thread owed is the running month's and nothing here is marked.
    expect(owed.map((t) => t.month)).toEqual([thisMonth]);
    expect(owed.every((t) => t.closedMonth === null)).toBe(true);
    // The closed month's own thread still carries its note, read where it lives.
    const [older] = await tx((d) => listThreads(d, tenantId, month));
    expect(older!.closedMonth!.month).toBe(month);
  });
});
