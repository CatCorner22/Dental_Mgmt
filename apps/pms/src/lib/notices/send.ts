import { and, desc, eq } from "drizzle-orm";
import { noticeSends, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { currentAddress } from "./addresses";
import { renderMessage, type Message } from "./message";
import type { Notice, NoticeSeat } from "./outstanding";
import type { SendOutcome, SendRecord } from "./sendOutcome";
import type { Transport } from "./transport";

/**
 * Sending, and failing to send (Increment 1.59).
 *
 * Increment 1.58 built the message and recorded where it would go, and sent
 * nothing. This sends, and the interesting half is what happens when it
 * cannot.
 *
 * **A failed send is visible.** That is the whole rule. A bounce, a transport
 * nobody configured, a provider that refuses: each is a signal that did not
 * arrive about a practice that owed something. A product that swallowed one
 * would be worse than a product that never sent, because the owner would
 * believe they had been told. So every attempt writes a row, and the row that
 * says what failed is the point of the table rather than an exception to it.
 *
 * **Nothing owed writes nothing.** No message, no attempt, no row. A table of
 * rows recording that nothing happened is a table nobody can read, and "we
 * checked and there was nothing" is already on the screen, where a reader went
 * looking.
 *
 * **The body goes through `renderMessage` and nowhere else.** Increment 1.58
 * made it impossible for the renderer to read a person's typed words by typing
 * its input as `Omit<Notice, "sentence">`. This module hands it notices and
 * takes what comes back; it never assembles a body of its own, which is what
 * keeps that guarantee true once the words actually leave.
 */

// The shape of an outcome and the sentence that reads it live in a pure module
// the client can import; a client component that reached this file would drag
// `pg` into the browser bundle, which `next build` refuses and TypeScript does
// not mention.
export type { SendOutcome, SendRecord } from "./sendOutcome";
export { sendSentence } from "./sendOutcome";

export type SendResult =
  | { outcome: "nothing_owed" }
  | { outcome: Exclude<SendOutcome, "nothing_owed">; record: SendRecord };

export type SendInput = {
  tenantId: string;
  recipientId: string;
  recipientName: string;
  seat: NoticeSeat;
  practiceName: string;
  appUrl: string;
  notices: Notice[];
  transport: Transport;
  at?: Date;
};

/**
 * The latest attempt for one person, or null where nobody has ever tried.
 *
 * Newest row wins, like an address: the table is append-only, so a person
 * accumulates attempts and only the last one says where delivery stands.
 */
export async function lastSend(db: AppDb, tenantId: string, recipientId: string): Promise<SendRecord | null> {
  const rows = await db
    .select()
    .from(noticeSends)
    .where(and(eq(noticeSends.tenantId, tenantId), eq(noticeSends.recipientId, recipientId)))
    .orderBy(desc(noticeSends.attemptedAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    seat: row.seat as NoticeSeat,
    recipientName: row.recipientName,
    address: row.address,
    outcome: row.outcome as SendRecord["outcome"],
    detail: row.detail,
    subject: row.subject,
    noticeCount: row.noticeCount,
    attemptedAt: row.attemptedAt.toISOString(),
  };
}

/**
 * Sends this person their own notices, and records what happened.
 *
 * The caller passes the notices rather than this module reading them, so that
 * the same list a person saw on the screen is the list that goes out — a second
 * reading could differ from the one they were looking at, and a message that
 * disagrees with the screen it came from is worse than no message.
 */
export async function sendNotices(db: AppDb, input: SendInput): Promise<SendResult> {
  const at = input.at ?? new Date();
  const message: Message | null = renderMessage({
    practiceName: input.practiceName,
    seat: input.seat,
    notices: input.notices,
    appUrl: input.appUrl,
  });

  // Nothing owed is not an act. No message, no attempt, no row.
  if (message === null) return { outcome: "nothing_owed" };

  const held = await currentAddress(db, input.tenantId, input.recipientId);
  const count = input.notices.filter((n) => n.seat === input.seat).length;

  let outcome: SendRecord["outcome"];
  let detail: string | null;
  let address: string | null;

  if (held === null || held.address === null) {
    // Something is owed and there is nowhere to send it. Not an error, and not
    // nothing: a practice owes something and no one will hear about it.
    outcome = "unreachable";
    address = null;
    detail =
      held === null
        ? "Nobody has said where to send these, so there was nowhere to send them."
        : `You asked on ${held.setAt.slice(0, 10)} not to receive these, so there was nowhere to send them.`;
  } else {
    const delivery = await input.transport.send(held.address, message);
    address = held.address;
    outcome = delivery.ok ? "sent" : "failed";
    detail = delivery.ok ? null : delivery.why;
  }

  await db.insert(noticeSends).values({
    id: uuidv7(),
    tenantId: input.tenantId,
    seat: input.seat,
    recipientId: input.recipientId,
    recipientName: input.recipientName,
    address,
    outcome,
    detail,
    // A message was built either way, and what it said is what somebody would
    // have received; keeping it on a failure is what makes the failure legible.
    subject: message.subject,
    body: message.body,
    noticeCount: count,
    attemptedAt: at,
  });

  // The chain names the act and its outcome, never the address and never the
  // body: the chain is read by people who may govern this practice without
  // being this person.
  await appendControlEvent(
    db,
    input.tenantId,
    input.recipientId,
    "notice.sent",
    { seat: input.seat, outcome, count },
    at
  );

  return {
    outcome,
    record: {
      seat: input.seat,
      recipientName: input.recipientName,
      address,
      outcome,
      detail,
      subject: message.subject,
      noticeCount: count,
      attemptedAt: at.toISOString(),
    },
  };
}
