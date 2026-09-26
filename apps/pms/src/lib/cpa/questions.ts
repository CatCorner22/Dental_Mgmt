import { and, asc, eq } from "drizzle-orm";
import { cpaThreadMessages, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { computeMonthPackage, packageHash, packageRows } from "./package";
import { listMonthCloses, loadMonthClose } from "./close";
import { closedMonthNote, type ClosedMonthNote } from "./closedMonthNote";

/**
 * The question verb (Increment 1.50, docs/13 item 22).
 *
 * The month-end package has been one-way since Increment 1.34: the accountant
 * reads it and exports it, and asks about a figure by email, where the question
 * and its answer end up somewhere other than the month they are about. A thread
 * here hangs on the package line it is about and lives beside the month.
 *
 * Two rules shape it.
 *
 * **A question names a line the package states.** `subjectKey` is the section
 * and key `packageRows` gives every row, and opening a thread is refused when
 * that month's package holds no such row. A question floating beside the
 * package rather than pointing into it is the thing email already does badly.
 *
 * **Nothing is edited.** The table is append-only, so an answer that was wrong
 * is followed by another message rather than replaced — the same treatment a
 * posting gets from a correction. Which side owes the next message is read from
 * the last one's seat, never from a status column that could disagree with the
 * messages under it.
 */

export type ThreadSeat = "accountant" | "practice";

export type ThreadMessage = {
  id: string;
  threadId: string;
  month: string;
  subjectKey: string;
  body: string;
  authorSeat: ThreadSeat;
  authorName: string;
  createdAt: string;
};

export type Thread = {
  id: string;
  month: string;
  subjectKey: string;
  /** The package line as it read when the thread is displayed, or null once the shape no longer holds it. */
  subjectLabel: string | null;
  messages: ThreadMessage[];
  /** True while the last word is the accountant's: the practice owes an answer. */
  awaitingPractice: boolean;
  /**
   * Set once the month this thread is about has been closed (Increment 1.54).
   *
   * A thread about a closed month calls for a different answer from one about
   * an open month, and read alike they are indistinguishable. Null means the
   * month is still open, not that nobody looked.
   */
  closedMonth: ClosedMonthNote | null;
  askedAt: string;
  lastAt: string;
};

export type QuestionRefusal = {
  ok: false;
  status: 400 | 404;
  code: "invalid" | "unknown_line" | "not_found";
  verb: string;
  why: string;
};

export type QuestionResult = { ok: true; thread: Thread } | QuestionRefusal;

/** At least this many characters, so a message says something. Mirrors the column's CHECK. */
const MIN_BODY = 10;

function toMessage(row: typeof cpaThreadMessages.$inferSelect): ThreadMessage {
  return {
    id: row.id,
    threadId: row.threadId,
    month: row.month,
    subjectKey: row.subjectKey,
    body: row.body,
    authorSeat: row.authorSeat === "accountant" ? "accountant" : "practice",
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every message of one month, gathered into threads, oldest thread first. */
export async function listThreads(db: AppDb, tenantId: string, month: string): Promise<Thread[]> {
  const rows = await db
    .select()
    .from(cpaThreadMessages)
    .where(and(eq(cpaThreadMessages.tenantId, tenantId), eq(cpaThreadMessages.month, month)))
    .orderBy(asc(cpaThreadMessages.createdAt));
  const labels = await labelsFor(db, tenantId, month);
  // One month, so one close to read.
  const close = await loadMonthClose(db, tenantId, month);
  const note = close ? closedMonthNote({ month, closedAt: close.closedAt, closedByName: close.closedByName }) : null;
  return gather(rows.map(toMessage), (m) => labels.get(m.subjectKey) ?? null, () => note);
}

/**
 * Every thread the practice still owes an answer on, whatever month it is about.
 *
 * It resolves no labels: the owner board reads this on every render, and a label
 * costs one whole month-end package to compute. The question's own words carry
 * the meaning and the subject key names the line; the `/cpa` screen, which has
 * already computed that month's package, is where the line reads in full.
 *
 * It does resolve the close (Increment 1.54), because that costs one indexed
 * read for every thread rather than a package apiece, and because it changes
 * what a true answer says: the owner answering a question about a month they
 * have closed needs to know that before they answer, not after.
 */
export async function threadsAwaitingPractice(db: AppDb, tenantId: string): Promise<Thread[]> {
  return (await allThreadsUnlabelled(db, tenantId)).filter((t) => t.awaitingPractice);
}

/**
 * Every thread of every month, label-free, for a reader that needs them all.
 *
 * Label-free for the reason `threadsAwaitingPractice` is: one label costs a
 * whole month-end package to compute, and a caller that wants them all would
 * pay that per month. `/cpa`, which has already computed one month's package,
 * is where a line reads in full.
 */
export async function allThreadsUnlabelled(db: AppDb, tenantId: string): Promise<Thread[]> {
  const rows = await db
    .select()
    .from(cpaThreadMessages)
    .where(eq(cpaThreadMessages.tenantId, tenantId))
    .orderBy(asc(cpaThreadMessages.createdAt));
  const notes = new Map(
    (await listMonthCloses(db, tenantId)).map((c) => [c.month, closedMonthNote({ month: c.month, closedAt: c.closedAt, closedByName: c.closedByName })])
  );
  return gather(rows.map(toMessage), () => null, (month) => notes.get(month) ?? null);
}

/**
 * Every line this month's package states, as the form offers them. The screen
 * is a client component and cannot import the package module, which reaches the
 * database; the route hands it these instead.
 */
export async function listLines(db: AppDb, tenantId: string, month: string): Promise<{ key: string; label: string }[]> {
  return [...(await labelsFor(db, tenantId, month))].map(([key, label]) => ({ key, label }));
}

/** The label of every line this month's package states, keyed by its subject key. */
async function labelsFor(db: AppDb, tenantId: string, month: string): Promise<Map<string, string>> {
  const pkg = await computeMonthPackage(db, tenantId, month);
  const rows = packageRows(pkg, packageHash(pkg));
  return new Map(rows.map((r) => [`${r.section}|${r.key}`, r.label]));
}

function gather(
  messages: ThreadMessage[],
  labelOf: (m: ThreadMessage) => string | null,
  closeOf: (month: string) => ClosedMonthNote | null
): Thread[] {
  const byThread = new Map<string, ThreadMessage[]>();
  for (const m of messages) {
    const list = byThread.get(m.threadId);
    if (list) list.push(m);
    else byThread.set(m.threadId, [m]);
  }
  const threads: Thread[] = [];
  for (const [id, list] of byThread) {
    const opener = list[0]!;
    const last = list[list.length - 1]!;
    threads.push({
      id,
      month: opener.month,
      subjectKey: opener.subjectKey,
      subjectLabel: labelOf(opener),
      messages: list,
      awaitingPractice: last.authorSeat === "accountant",
      closedMonth: closeOf(opener.month),
      askedAt: opener.createdAt,
      lastAt: last.createdAt,
    });
  }
  return threads.sort((a, b) => (a.askedAt < b.askedAt ? -1 : a.askedAt > b.askedAt ? 1 : 0));
}

type Actor = { id: string; name: string };

/**
 * Opens a thread on one line of one month's package.
 *
 * The line has to exist in that month's package. A practice seat may ask too —
 * an office manager reading the month has the same need — and the seat recorded
 * is the asker's, not their rank.
 */
export async function askAboutLine(
  db: AppDb,
  input: { tenantId: string; actor: Actor; seat: ThreadSeat; month: string; subjectKey: string; body: string; now?: Date }
): Promise<QuestionResult> {
  const now = input.now ?? new Date();
  const body = input.body.trim();
  if (body.length < MIN_BODY) {
    return { ok: false, status: 400, code: "invalid", verb: "Say what you are asking", why: `A question is at least ${MIN_BODY} characters, so the answer has something to answer.` };
  }
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return { ok: false, status: 400, code: "invalid", verb: "Choose a month", why: "A month reads as YYYY-MM." };
  }

  const labels = await labelsFor(db, input.tenantId, input.month);
  const label = labels.get(input.subjectKey);
  if (label === undefined) {
    return {
      ok: false,
      status: 404,
      code: "unknown_line",
      verb: "Ask about a line of the package",
      why: `${input.month}'s package states no line "${input.subjectKey}". A question hangs on a figure the package reports, so the answer is about something both sides can read.`,
    };
  }

  const id = uuidv7(now.getTime());
  await db.insert(cpaThreadMessages).values({
    id,
    tenantId: input.tenantId,
    threadId: id,
    month: input.month,
    subjectKey: input.subjectKey,
    body,
    authorSeat: input.seat,
    authorId: input.actor.id,
    authorName: input.actor.name,
    createdAt: now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "cpa.question_asked",
    { threadId: id, month: input.month, subjectKey: input.subjectKey, seat: input.seat },
    now
  );
  return { ok: true, thread: (await loadThread(db, input.tenantId, id, labels))! };
}

/** Adds a message to a thread that already exists. Either side may speak. */
export async function replyToThread(
  db: AppDb,
  input: { tenantId: string; actor: Actor; seat: ThreadSeat; threadId: string; body: string; now?: Date }
): Promise<QuestionResult> {
  const now = input.now ?? new Date();
  const body = input.body.trim();
  if (body.length < MIN_BODY) {
    return { ok: false, status: 400, code: "invalid", verb: "Say something", why: `An answer is at least ${MIN_BODY} characters.` };
  }

  const existing = await db
    .select()
    .from(cpaThreadMessages)
    .where(and(eq(cpaThreadMessages.tenantId, input.tenantId), eq(cpaThreadMessages.id, input.threadId)))
    .limit(1);
  const opener = existing[0];
  if (!opener || opener.threadId !== opener.id) {
    return { ok: false, status: 404, code: "not_found", verb: "Choose a thread", why: "This practice holds no such thread." };
  }

  await db.insert(cpaThreadMessages).values({
    id: uuidv7(now.getTime()),
    tenantId: input.tenantId,
    threadId: opener.id,
    month: opener.month,
    subjectKey: opener.subjectKey,
    body,
    authorSeat: input.seat,
    authorId: input.actor.id,
    authorName: input.actor.name,
    createdAt: now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "cpa.question_answered",
    { threadId: opener.id, month: opener.month, subjectKey: opener.subjectKey, seat: input.seat },
    now
  );
  return { ok: true, thread: (await loadThread(db, input.tenantId, opener.id, await labelsFor(db, input.tenantId, opener.month)))! };
}

async function loadThread(db: AppDb, tenantId: string, threadId: string, labels: Map<string, string>): Promise<Thread | null> {
  const rows = await db
    .select()
    .from(cpaThreadMessages)
    .where(and(eq(cpaThreadMessages.tenantId, tenantId), eq(cpaThreadMessages.threadId, threadId)))
    .orderBy(asc(cpaThreadMessages.createdAt));
  if (rows.length === 0) return null;
  // The thread a write returns reads the close exactly as a later list of it
  // will: a message written into a closed month says so from the moment it
  // lands, rather than only once the screen is loaded again.
  const month = rows[0]!.month;
  const close = await loadMonthClose(db, tenantId, month);
  const note = close ? closedMonthNote({ month, closedAt: close.closedAt, closedByName: close.closedByName }) : null;
  return gather(rows.map(toMessage), (m) => labels.get(m.subjectKey) ?? null, () => note)[0] ?? null;
}
