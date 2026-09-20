import { and, desc, eq } from "drizzle-orm";
import { noticeSends, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { currentAddress } from "./addresses";
import { currentProof, proofLapsesAt, proofStanding } from "./proof";
import { renderMessage, type Message } from "./message";
import type { Notice, NoticeSeat } from "./outstanding";
import type { FailureKind, SendOutcome, SendRecord } from "./sendOutcome";
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
 *
 * **A refusal that can pass is tried again; one that cannot is not**
 * (Increment 1.60). Increment 1.59 made a failure visible and left it there,
 * so a provider that was unavailable for a second cost the practice the whole
 * message. Now the transport says which kind of refusal it gave, and this
 * module acts on the answer: up to three attempts against a transient refusal,
 * and exactly one against a permanent one, because a second attempt at an
 * address that does not exist spends a person's wait on an outcome nobody can
 * reach.
 *
 * **The retrying leaves rows, not a counter.** Every attempt writes its own
 * row before the next one begins, so how many times the practice tried is
 * answered by counting rows. A tries-so-far number beside them would be a
 * status the rows under it could contradict, which is the shape this codebase
 * has refused since the owner board's counts — and it would be the queue this
 * increment is careful not to become.
 */

// The shape of an outcome and the sentence that reads it live in a pure module
// the client can import; a client component that reached this file would drag
// `pg` into the browser bundle, which `next build` refuses and TypeScript does
// not mention.
export type { FailureKind, SendOutcome, SendRecord } from "./sendOutcome";
export { sendSentence } from "./sendOutcome";

export type SendResult =
  | { outcome: "nothing_owed" }
  | {
      outcome: Exclude<SendOutcome, "nothing_owed">;
      /** The final attempt, which is the one a reader is asking about. */
      record: SendRecord;
      /**
       * How many times the transport was asked, for this act only. It is
       * reported rather than stored: the rows are the record, and a caller who
       * wants the number later counts them.
       */
      attempts: number;
    };

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
  /**
   * How the wait between attempts is spent. A test passes one that returns at
   * once, so a suite proving the retry rule does not also spend two seconds
   * proving that `setTimeout` works.
   */
  pause?: (ms: number) => Promise<void>;
};

/**
 * The whole retry rule, in one place a reader can check: wait half a second
 * before a second attempt, a second and a half before a third, and stop.
 *
 * The number of attempts is derived from the pauses rather than written beside
 * them, so the two cannot disagree.
 */
const PAUSES_MS = [500, 1_500] as const;
const MAX_ATTEMPTS = PAUSES_MS.length + 1;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** What one message needs to reach one person, or to be recorded as having reached nobody. */
/** What a message is, said on its row rather than inferred from its shape (Increment 1.64). */
export type MessageKind = "notices" | "proof_code" | "digest" | "package";

export type DeliveryInput = {
  tenantId: string;
  kind: MessageKind;
  recipientId: string;
  recipientName: string;
  seat: NoticeSeat;
  message: Message;
  /**
   * How many things the message named. Zero belongs to the code that proves an
   * address and to nothing else, which the database now holds as a rule rather
   * than leaving a reader to infer (Increment 1.64).
   */
  noticeCount: number;
  /** Where it goes, or null for "nowhere, and `why` says so". */
  address: string | null;
  why: string | null;
  transport: Transport;
  at?: Date;
  pause?: (ms: number) => Promise<void>;
};

export type Delivered = { record: SendRecord; attempts: number };

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
    // The id breaks a tie, and a tie is reachable: a caller that pins the time
    // gives every attempt in one act the same stamp, and "the latest attempt"
    // must not then depend on what the planner happens to return first.
    // `uuidv7` is time-ordered, so the largest id is the last row written.
    .orderBy(desc(noticeSends.attemptedAt), desc(noticeSends.id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    seat: row.seat as NoticeSeat,
    recipientName: row.recipientName,
    address: row.address,
    outcome: row.outcome as SendRecord["outcome"],
    detail: row.detail,
    // Null on anything but a failure, and on a failure older than Increment
    // 1.60, which reads exactly as it read before the distinction existed.
    failureKind: (row.failureKind as FailureKind | null) ?? null,
    subject: row.subject,
    noticeCount: row.noticeCount,
    attemptedAt: row.attemptedAt.toISOString(),
  };
}

/**
 * What the last message of notices that actually reached this person said, and
 * when — or null where none has.
 *
 * "Reached", not "attempted": a send that failed told them nothing, so it must
 * not suppress the next one (Increment 1.62). The kind keeps the three
 * messages apart, since what a person was last told they owe says nothing
 * about when they were last sent a digest, and neither says anything about a
 * code (Increment 1.64).
 *
 * It returns the body rather than a `SendRecord` because the body is what the
 * round compares: two identical bodies say the same thing, and comparing what
 * was actually sent is one fewer thing that can drift than comparing a digest
 * computed beside it.
 */
export async function lastDelivered(
  db: AppDb,
  tenantId: string,
  recipientId: string,
  kind: MessageKind = "notices"
): Promise<{ body: string; at: Date } | null> {
  const rows = await db
    .select({ body: noticeSends.body, attemptedAt: noticeSends.attemptedAt })
    .from(noticeSends)
    .where(
      and(
        eq(noticeSends.tenantId, tenantId),
        eq(noticeSends.recipientId, recipientId),
        eq(noticeSends.outcome, "sent"),
        eq(noticeSends.kind, kind)
      )
    )
    .orderBy(desc(noticeSends.attemptedAt), desc(noticeSends.id))
    .limit(1);
  const row = rows[0];
  return row && row.body !== null ? { body: row.body, at: row.attemptedAt } : null;
}

/**
 * Sends this person their own notices, and records what happened.
 *
 * The caller passes the notices rather than this module reading them, so that
 * the same list a person saw on the screen is the list that goes out — a second
 * reading could differ from the one they were looking at, and a message that
 * disagrees with the screen it came from is worse than no message.
 */
/**
 * The attempt loop, and the only copy of it.
 *
 * Both the notices a seat owes and the code that proves an address reach a
 * person through here (Increment 1.61), so the retry rule, the row per
 * attempt, and the stamp on each attempt are written once. A second copy would
 * be a second rule, and the two would drift the first time one was changed.
 *
 * A null `address` means there was nowhere to send, and `why` says so; the
 * transport is not asked, and no attempt is counted.
 */
export async function deliverMessage(db: AppDb, input: DeliveryInput): Promise<Delivered> {
  const pause = input.pause ?? sleep;

  const record = async (
    outcome: SendRecord["outcome"],
    address: string | null,
    detail: string | null,
    failureKind: FailureKind | null
  ): Promise<SendRecord> => {
    // Each attempt stamps its own moment, because attempts inside one act are
    // seconds apart and a column called `attempted_at` should say when the
    // attempt was. A caller that pinned a time pins every attempt to it, which
    // is what a test wants and what no deployment does.
    const attemptedAt = input.at ?? new Date();
    await db.insert(noticeSends).values({
      id: uuidv7(),
      tenantId: input.tenantId,
      seat: input.seat,
      recipientId: input.recipientId,
      recipientName: input.recipientName,
      address,
      outcome,
      detail,
      failureKind,
      kind: input.kind,
      // A message was built either way, and what it said is what somebody would
      // have received; keeping it on a failure is what makes the failure legible.
      subject: input.message.subject,
      body: input.message.body,
      noticeCount: input.noticeCount,
      attemptedAt,
    });
    return {
      seat: input.seat,
      recipientName: input.recipientName,
      address,
      outcome,
      detail,
      failureKind,
      subject: input.message.subject,
      noticeCount: input.noticeCount,
      attemptedAt: attemptedAt.toISOString(),
    };
  };

  if (input.address === null) {
    return { record: await record("unreachable", null, input.why, null), attempts: 0 };
  }

  const address = input.address;
  for (let attempt = 1; ; attempt += 1) {
    const delivery = await input.transport.send(address, input.message);
    if (delivery.ok) return { record: await record("sent", address, null, null), attempts: attempt };

    const written = await record("failed", address, delivery.why, delivery.kind);
    // A permanent refusal ends the act here. Trying an address that does not
    // exist a second time changes nothing and spends the waiting person's time.
    if (delivery.kind === "permanent" || attempt >= MAX_ATTEMPTS) return { record: written, attempts: attempt };
    await pause(PAUSES_MS[attempt - 1]!);
  }
}

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

  /**
   * Where this goes, or why it goes nowhere.
   *
   * Three ways to have nowhere to send, and the third is Increment 1.61's: an
   * address nobody has proved reaches this person is not a destination. A
   * message to a mistyped address does not fail — it is accepted by whoever
   * does own that mailbox, silently, which is the one outcome this arc exists
   * to prevent. So an unproved address is `unreachable` rather than `sent`,
   * recorded like any other, and the reason says what would change it.
   */
  let address: string | null = null;
  let why: string | null = null;
  if (held === null) {
    why = "Nobody has said where to send these, so there was nowhere to send them.";
  } else if (held.address === null) {
    why = `You asked on ${held.setAt.slice(0, 10)} not to receive these, so there was nowhere to send them.`;
  } else {
    // A lapsed proof is no proof (Increment 1.65). An address nobody has
    // confirmed in a year is not a destination, and it refuses exactly as a
    // never-proved one does rather than earning an outcome of its own — what
    // differs is only the reason, because "nobody ever said" and "nobody has
    // said lately" call for different things from the reader.
    const proof = await currentProof(db, input.tenantId, held.id);
    const standing = proofStanding(proof, at);
    if (standing === "none") {
      why =
        "Nobody has proved that this address reaches you, so nothing was sent to it. " +
        "Ask for a code and bring it back, and these will go out.";
    } else if (standing === "lapsed") {
      why =
        `The proof that this address reaches you lapsed on ${proofLapsesAt(proof!).slice(0, 10)}, so nothing was sent to it. ` +
        "Ask for a code and bring it back, and these will go out.";
    } else {
      address = held.address;
    }
  }

  const { record, attempts } = await deliverMessage(db, {
    tenantId: input.tenantId,
    kind: "notices",
    recipientId: input.recipientId,
    recipientName: input.recipientName,
    seat: input.seat,
    message,
    noticeCount: count,
    address,
    why,
    transport: input.transport,
    at: input.at,
    pause: input.pause,
  });

  // The chain names the act and its outcome, never the address and never the
  // body: the chain is read by people who may govern this practice without
  // being this person. One event for the act rather than one per attempt,
  // because a person asked to be sent their notices once; the attempts are in
  // the table, where a reader who wants them can count them.
  await appendControlEvent(
    db,
    input.tenantId,
    input.recipientId,
    "notice.sent",
    { seat: input.seat, outcome: record.outcome, count, attempts },
    at
  );

  return { outcome: record.outcome, record, attempts };
}
