import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { askAboutLine, listThreads, replyToThread } from "./questions";
import { latestReads, markThreadRead, unreadFor } from "./threadReads";

/**
 * Reading an answer, recorded (Increment 1.55).
 *
 * The accountant asks, the practice answers, and until now nothing told the
 * accountant the answer had landed. A badge would never clear; a stamped read
 * does, and is worth keeping on its own. These cases drive the whole life of
 * one thread: unread, read, re-opened by a later message, read again.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const accountant = DEV_USERS.find((u) => u.username === "ridgeview-cpa")!;
const asOwner = { id: owner.id, name: owner.displayName };
const asAccountant = { id: accountant.id, name: accountant.displayName };
const month = new Date().toISOString().slice(0, 7);
const LINE = "journal|total";

describe.skipIf(!adminUrl)("marking an answer read (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  let threadId = "";

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  async function readCount(): Promise<number> {
    const { rows } = await db.admin.query("SELECT count(*)::int AS n FROM cpa_thread_reads WHERE tenant_id = $1", [tenantId]);
    return rows[0].n as number;
  }

  /** Whether the accountant has anything unread in the thread, read as the screen reads it. */
  async function accountantUnread(): Promise<boolean> {
    return tx(async (d) => {
      const [thread] = await listThreads(d, tenantId, month);
      const reads = await latestReads(d, tenantId, "accountant");
      return unreadFor(thread!, "accountant", reads.get(thread!.id));
    });
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };

    const asked = await tx((d) =>
      askAboutLine(d, {
        tenantId,
        actor: asAccountant,
        seat: "accountant",
        month,
        subjectKey: LINE,
        body: "The journal total sits under the deposits for the month. What am I missing?",
      })
    );
    if (!asked.ok) throw new Error("the seed question was refused");
    threadId = asked.thread.id;
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("refuses to mark a thread whose last word is the reader's own, and writes nothing", async () => {
    const before = await readCount();
    // The accountant asked and nobody has answered: there is nothing to read.
    const refused = await tx((d) => markThreadRead(d, { tenantId, actor: asAccountant, seat: "accountant", threadId }));
    expect(refused).toMatchObject({ ok: false, status: 409, code: "nothing_new" });
    if (refused.ok) return;
    expect(refused.why).toMatch(/a message you wrote is one you have seen/);
    expect(await accountantUnread()).toBe(false);
    expect(await readCount()).toBe(before);
  });

  it("refuses a thread this practice does not hold", async () => {
    const refused = await tx((d) =>
      markThreadRead(d, { tenantId, actor: asAccountant, seat: "accountant", threadId: uuidv7(Date.now()) })
    );
    expect(refused).toMatchObject({ ok: false, status: 404, code: "not_found" });
  });

  it("marks the practice's answer read, records who and when, and reaches the chain", async () => {
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
    expect(await accountantUnread()).toBe(true);

    const marked = await tx((d) => markThreadRead(d, { tenantId, actor: asAccountant, seat: "accountant", threadId }));
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect(marked.read).toMatchObject({ threadId, seat: "accountant", readerName: accountant.displayName });

    const { rows } = await db.admin.query(
      "SELECT kind, payload FROM domain_event WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1",
      [tenantId]
    );
    expect(rows[0].kind).toBe("cpa.answer_read");
    expect(rows[0].payload).toMatchObject({ threadId, month, subjectKey: LINE, seat: "accountant" });

    expect(await accountantUnread()).toBe(false);
  });

  it("refuses a second mark while nothing has been said since, naming who read it", async () => {
    const before = await readCount();
    const again = await tx((d) => markThreadRead(d, { tenantId, actor: asAccountant, seat: "accountant", threadId }));
    expect(again).toMatchObject({ ok: false, status: 409, code: "nothing_new" });
    if (again.ok) return;
    expect(again.why).toMatch(new RegExp(`${accountant.displayName} marked this thread read`));
    // The table carries acts, not a pile of rows asserting the same thing.
    expect(await readCount()).toBe(before);
  });

  it("re-opens on a later message, and the earlier read still says truly what it said", async () => {
    const before = await tx((d) => latestReads(d, tenantId, "accountant"));
    const earlier = before.get(threadId)!;

    const more = await tx((d) =>
      replyToThread(d, {
        tenantId,
        actor: asOwner,
        seat: "practice",
        threadId,
        body: "One of those two has now posted, so the figure moves next month rather than this one.",
      })
    );
    expect(more.ok).toBe(true);
    expect(await accountantUnread()).toBe(true);

    const marked = await tx((d) => markThreadRead(d, { tenantId, actor: asAccountant, seat: "accountant", threadId }));
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    // A new row rather than a rewrite: the first read is still in the table,
    // still naming the message it actually covered.
    expect(marked.read.upToMessageId).not.toBe(earlier.upToMessageId);
    const { rows } = await db.admin.query(
      "SELECT up_to_message_id FROM cpa_thread_reads WHERE tenant_id = $1 AND thread_id = $2 ORDER BY read_at",
      [tenantId, threadId]
    );
    expect(rows.map((r) => r.up_to_message_id)).toEqual([earlier.upToMessageId, marked.read.upToMessageId]);
    expect(await accountantUnread()).toBe(false);
  });

  it("reads each seat separately, so the accountant's mark never clears the practice's", async () => {
    // The accountant has read everything; the practice has read nothing, and
    // the thread's last word is the practice's own, so it is owed no reading.
    const practiceReads = await tx((d) => latestReads(d, tenantId, "practice"));
    expect(practiceReads.size).toBe(0);
    const accountantReads = await tx((d) => latestReads(d, tenantId, "accountant"));
    expect(accountantReads.get(threadId)).toBeDefined();
  });

  it("is append-only in the database, and refuses a read naming another thread's message", async () => {
    const { rows } = await db.admin.query("SELECT id FROM cpa_thread_reads WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    await expect(
      db.admin.query("UPDATE cpa_thread_reads SET reader_name = 'rewritten' WHERE id = $1", [rows[0].id])
    ).rejects.toMatchObject({ message: expect.stringContaining("append-only") });
    await expect(db.admin.query("DELETE FROM cpa_thread_reads WHERE id = $1", [rows[0].id])).rejects.toMatchObject({
      message: expect.stringContaining("append-only"),
    });

    // A second thread, whose message must not clear a signal about the first.
    const other = await tx((d) =>
      askAboutLine(d, {
        tenantId,
        actor: asAccountant,
        seat: "accountant",
        month,
        subjectKey: LINE,
        body: "And separately, which deposits does the register count for this month?",
      })
    );
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    await expect(
      db.admin.query(
        `INSERT INTO cpa_thread_reads (id, tenant_id, thread_id, seat, up_to_message_id, reader_id, reader_name, read_at)
         VALUES ($1, $2, $3, 'accountant', $4, $5, 'Casey Prentice', now())`,
        [uuidv7(Date.now()), tenantId, threadId, other.thread.messages[0]!.id, accountant.id]
      )
    ).rejects.toMatchObject({ message: expect.stringContaining("belongs to thread") });
  });
});
