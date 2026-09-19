import { and, asc, desc, eq } from "drizzle-orm";
import { cpaThreadMessages, cpaThreadReads, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import type { Thread, ThreadSeat } from "./questions";

/**
 * Reading an answer is an act, and the act is recorded (Increment 1.55).
 *
 * Increment 1.50 made the package two-way, and left it lopsided. The practice
 * learns it owes an answer, because the owner board reads the last message's
 * seat. The accountant learns nothing: an answer lands in a thread on a screen
 * nobody is watching, and finding it means re-reading every thread of every
 * month.
 *
 * A badge for "the practice has answered" would be worse than nothing, because
 * it never clears — and a signal that is always on is not a signal. What clears
 * it is somebody reading the answer, and that is worth recording rather than
 * inferring: an accountant closing a month-end file is asserting they saw what
 * the practice said. So this is stamped, like the digest acknowledgment of
 * Increment 1.28, rather than written by the act of loading a screen. A GET
 * that writes would make the record a side effect of a page view, which is a
 * weaker claim than the one the file needs.
 */

export type ThreadRead = {
  threadId: string;
  seat: ThreadSeat;
  upToMessageId: string;
  readerName: string;
  /** ISO timestamp. */
  readAt: string;
};

export type ReadRefusal = {
  ok: false;
  status: 404 | 409;
  code: "not_found" | "nothing_new";
  verb: string;
  why: string;
};

export type ReadResult = { ok: true; read: ThreadRead } | ReadRefusal;

/**
 * The latest read per thread for one seat, keyed by thread id.
 *
 * One query for every thread: the rows are ordered newest first and the first
 * row seen for a thread wins, because a seat accumulates read rows over a
 * thread's life and only the last one says how far it got.
 */
export async function latestReads(db: AppDb, tenantId: string, seat: ThreadSeat): Promise<Map<string, ThreadRead>> {
  const rows = await db
    .select()
    .from(cpaThreadReads)
    .where(and(eq(cpaThreadReads.tenantId, tenantId), eq(cpaThreadReads.seat, seat)))
    .orderBy(desc(cpaThreadReads.readAt));
  const latest = new Map<string, ThreadRead>();
  for (const r of rows) {
    if (latest.has(r.threadId)) continue;
    latest.set(r.threadId, {
      threadId: r.threadId,
      seat: r.seat === "accountant" ? "accountant" : "practice",
      upToMessageId: r.upToMessageId,
      readerName: r.readerName,
      readAt: r.readAt.toISOString(),
    });
  }
  return latest;
}

/**
 * Whether this seat has something in `thread` it has not marked as read.
 *
 * The seat's own last word is never unread: a message you wrote is one you
 * have seen. So the question is only ever about the other side's last message,
 * and a read that names it settles the thread until the next one lands.
 */
export function unreadFor(thread: Thread, seat: ThreadSeat, read: ThreadRead | undefined): boolean {
  const last = thread.messages[thread.messages.length - 1];
  if (!last || last.authorSeat === seat) return false;
  return read?.upToMessageId !== last.id;
}

/**
 * Records that `seat` read `threadId` up to its last message.
 *
 * Refuses a thread this practice does not hold (404) and one where the seat has
 * nothing new to read (409), so the table carries acts rather than a pile of
 * rows asserting the same thing. The message the read names is the thread's own
 * last, read inside the same transaction, so the row can never claim to have
 * seen a message that is not there.
 */
export async function markThreadRead(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; seat: ThreadSeat; threadId: string; now?: Date }
): Promise<ReadResult> {
  const now = input.now ?? new Date();
  const messages = await db
    .select()
    .from(cpaThreadMessages)
    .where(and(eq(cpaThreadMessages.tenantId, input.tenantId), eq(cpaThreadMessages.threadId, input.threadId)))
    .orderBy(asc(cpaThreadMessages.createdAt));
  const last = messages[messages.length - 1];
  if (!last) {
    return { ok: false, status: 404, code: "not_found", verb: "Not marked", why: "This practice holds no such thread." };
  }
  if (last.authorSeat === input.seat) {
    return {
      ok: false,
      status: 409,
      code: "nothing_new",
      verb: "Nothing to mark",
      why: "The last word in this thread is your own, and a message you wrote is one you have seen.",
    };
  }

  const already = (await latestReads(db, input.tenantId, input.seat)).get(input.threadId);
  if (already?.upToMessageId === last.id) {
    return {
      ok: false,
      status: 409,
      code: "nothing_new",
      verb: "Already read",
      why: `${already.readerName} marked this thread read on ${already.readAt.slice(0, 10)}, and nothing has been said since.`,
    };
  }

  await db.insert(cpaThreadReads).values({
    id: uuidv7(now.getTime()),
    tenantId: input.tenantId,
    threadId: input.threadId,
    seat: input.seat,
    upToMessageId: last.id,
    readerId: input.actor.id,
    readerName: input.actor.name,
    readAt: now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "cpa.answer_read",
    { threadId: input.threadId, month: last.month, subjectKey: last.subjectKey, seat: input.seat },
    now
  );
  return {
    ok: true,
    read: { threadId: input.threadId, seat: input.seat, upToMessageId: last.id, readerName: input.actor.name, readAt: now.toISOString() },
  };
}
