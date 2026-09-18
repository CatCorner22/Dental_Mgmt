import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { askAboutLine, listThreads, replyToThread, threadsAwaitingPractice } from "./questions";

/**
 * The accountant's question and the practice's answer on the seeded Ridgeview
 * tenant (Increment 1.50): a question hangs on a line the package states, both
 * halves reach the chain, the thread is append-only, and who owes the next
 * message is read from the last one rather than from a status column.
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
// Every package states its journal total, whatever the practice has posted.
const LINE = "journal|total";

describe.skipIf(!adminUrl)("the accountant's question (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

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

  async function messageCount(): Promise<number> {
    const { rows } = await db.admin.query("SELECT count(*)::int AS n FROM cpa_thread_messages WHERE tenant_id = $1", [tenantId]);
    return rows[0].n as number;
  }

  it("refuses a body that says nothing, a month that is not one, and a line the package does not state", async () => {
    const before = await messageCount();

    const short = await tx((d) => askAboutLine(d, { tenantId, actor: asAccountant, seat: "accountant", month, subjectKey: LINE, body: "why?" }));
    expect(short).toMatchObject({ ok: false, status: 400, code: "invalid" });

    const badMonth = await tx((d) =>
      askAboutLine(d, { tenantId, actor: asAccountant, seat: "accountant", month: "August", subjectKey: LINE, body: "Why did this move so far?" })
    );
    expect(badMonth).toMatchObject({ ok: false, status: 400, code: "invalid" });

    // A question that points at no line of the package is the thing email
    // already does badly, so it is refused rather than stored.
    const noLine = await tx((d) =>
      askAboutLine(d, { tenantId, actor: asAccountant, seat: "accountant", month, subjectKey: "journal|not_a_line", body: "Why did this move so far?" })
    );
    expect(noLine).toMatchObject({ ok: false, status: 404, code: "unknown_line" });
    if (noLine.ok) return;
    expect(noLine.why).toMatch(/states no line "journal\|not_a_line"/);

    expect(await messageCount()).toBe(before);
  });

  it("opens a thread on a line the package states, and the practice owes the answer", async () => {
    const asked = await tx((d) =>
      askAboutLine(d, {
        tenantId,
        actor: asAccountant,
        seat: "accountant",
        month,
        subjectKey: LINE,
        body: "The journal total is well under what the deposits show. What am I missing?",
      })
    );
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    expect(asked.thread).toMatchObject({ month, subjectKey: LINE, awaitingPractice: true });
    expect(asked.thread.subjectLabel).toBe("Journal total");
    expect(asked.thread.messages).toHaveLength(1);
    expect(asked.thread.messages[0]).toMatchObject({ authorSeat: "accountant", authorName: accountant.displayName });

    const { rows } = await db.admin.query(
      "SELECT kind, payload FROM domain_event WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1",
      [tenantId]
    );
    expect(rows[0].kind).toBe("cpa.question_asked");
    expect(rows[0].payload).toMatchObject({ threadId: asked.thread.id, month, subjectKey: LINE, seat: "accountant" });

    // The board reads it without computing a package, so it carries no label.
    const waiting = await tx((d) => threadsAwaitingPractice(d, tenantId));
    expect(waiting.map((t) => t.id)).toEqual([asked.thread.id]);
    expect(waiting[0]?.subjectLabel).toBeNull();
  });

  it("takes the practice's answer, and then owes nothing", async () => {
    const [open] = await tx((d) => threadsAwaitingPractice(d, tenantId));
    expect(open).toBeDefined();

    const answered = await tx((d) =>
      replyToThread(d, { tenantId, actor: asOwner, seat: "practice", threadId: open!.id, body: "Two deposits landed on the first of the next month; they are in that month's journal." })
    );
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.thread.awaitingPractice).toBe(false);
    expect(answered.thread.messages.map((m) => m.authorSeat)).toEqual(["accountant", "practice"]);

    const { rows } = await db.admin.query(
      "SELECT kind, payload FROM domain_event WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1",
      [tenantId]
    );
    expect(rows[0].kind).toBe("cpa.question_answered");
    expect(rows[0].payload).toMatchObject({ threadId: open!.id, seat: "practice" });

    expect(await tx((d) => threadsAwaitingPractice(d, tenantId))).toEqual([]);

    // The month's own list carries the line as the package reads it.
    const threads = await tx((d) => listThreads(d, tenantId, month));
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ subjectKey: LINE, subjectLabel: "Journal total", awaitingPractice: false });

    // The accountant may speak again, and then the practice owes an answer once more.
    const again = await tx((d) =>
      replyToThread(d, { tenantId, actor: asAccountant, seat: "accountant", threadId: open!.id, body: "Understood. Please send the next month's package when it closes." })
    );
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.thread.awaitingPractice).toBe(true);
    expect(again.thread.messages).toHaveLength(3);
  });

  it("refuses a reply to a thread this practice does not hold", async () => {
    const stranger = await tx((d) =>
      replyToThread(d, { tenantId, actor: asOwner, seat: "practice", threadId: uuidv7(Date.now()), body: "Answering something that does not exist." })
    );
    expect(stranger).toMatchObject({ ok: false, status: 404, code: "not_found" });
  });

  it("is append-only in the database, and a reply cannot be filed under another month or line", async () => {
    const { rows } = await db.admin.query(
      "SELECT id, thread_id, month, subject_key FROM cpa_thread_messages WHERE tenant_id = $1 ORDER BY created_at LIMIT 1",
      [tenantId]
    );
    const opener = rows[0];

    await expect(
      db.admin.query("UPDATE cpa_thread_messages SET body = 'rewritten' WHERE id = $1", [opener.id])
    ).rejects.toMatchObject({ message: expect.stringContaining("append-only") });
    await expect(
      db.admin.query("DELETE FROM cpa_thread_messages WHERE id = $1", [opener.id])
    ).rejects.toMatchObject({ message: expect.stringContaining("append-only") });

    // A reply naming a message that is itself a reply does not open a thread.
    const reply = await db.admin.query(
      "SELECT id FROM cpa_thread_messages WHERE tenant_id = $1 AND id <> thread_id LIMIT 1",
      [tenantId]
    );
    await expect(
      db.admin.query(
        `INSERT INTO cpa_thread_messages (id, tenant_id, thread_id, month, subject_key, body, author_seat, author_id, author_name, created_at)
         VALUES ($1, $2, $3, $4, $5, 'Filed under a reply rather than a thread.', 'practice', $6, 'Riley Owner', now())`,
        [uuidv7(Date.now()), tenantId, reply.rows[0].id, opener.month, opener.subject_key, owner.id]
      )
    ).rejects.toMatchObject({ message: expect.stringContaining("does not open in this practice") });

    // And a reply that wanders to another month or line is refused too.
    await expect(
      db.admin.query(
        `INSERT INTO cpa_thread_messages (id, tenant_id, thread_id, month, subject_key, body, author_seat, author_id, author_name, created_at)
         VALUES ($1, $2, $3, '2020-01', $4, 'Filed under a month it is not about.', 'practice', $5, 'Riley Owner', now())`,
        [uuidv7(Date.now()), tenantId, opener.thread_id, opener.subject_key, owner.id]
      )
    ).rejects.toMatchObject({ message: expect.stringContaining("carries its thread's month and subject") });
  });
});
