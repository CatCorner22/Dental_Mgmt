import { and, desc, eq, isNull, or } from "drizzle-orm";
import { noticeRounds, users, userEntitlements, noticeAddresses, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { isRole } from "../auth/roles";
import { CPA_SEAT_ENTITLEMENT, isCpaSeat } from "../auth/seats";
import { currentAddress } from "./addresses";
import { renderMessage } from "./message";
import { collectOutstanding, type NoticeSeat } from "./outstanding";
import { lastDelivered, sendNotices } from "./send";
import type { Transport } from "./transport";

/**
 * The round that runs without anybody pressing anything (Increment 1.62).
 *
 * Everything the notices arc has built so far waits to be asked. That is
 * backwards: a notice exists to reach a person who is **not** looking, and a
 * product that tells you things only when you open it has told you nothing you
 * could not have found yourself.
 *
 * Two questions were deliberately deferred to this increment, and only one of
 * them turned out to be a question.
 *
 * **"Since you last read" dissolves rather than resolves.** What a seat owes is
 * derived on every read (Increment 1.57) — it is a state, not a feed — so a
 * message does not need to know what somebody has seen. It needs to say what
 * is true now. Nothing records a read because nothing needs to.
 *
 * **What is real is repetition.** The same three sentences every morning is
 * noise, noise gets filtered, and a filtered signal is not a signal. So a round
 * sends only when **the message would differ from the last one that reached
 * this person**, or when that one has gone stale. Body against body: two
 * identical bodies say the same thing, and comparing what was actually sent is
 * one fewer thing that can drift than comparing a digest kept beside it.
 *
 * **Staleness is the other half, and it is not optional.** Change alone would
 * mean a debt nobody acts on is mentioned once and then never again, and
 * silence reads as "nothing owed" — so the thing most in need of attention
 * would be the quietest. A message that still stands is sent again each week.
 *
 * **Running it twice changes nothing.** Idempotence falls out of that rule
 * rather than out of a lock: a second round a minute later finds every message
 * unchanged and sends none. So the schedule itself can be wrong — early, late,
 * doubled by two workers — without a person being told twice.
 *
 * **A failure is not "told".** The comparison reads the last send that
 * actually left, so a message the transport refused does not suppress the next
 * round's attempt. Increment 1.59 made a failure visible; this keeps it from
 * also being silencing.
 */

/** How long a message that still stands waits before it is sent again. */
export const RESEND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type RoundOutcome = "sent" | "failed" | "unchanged" | "nothing_owed" | "unreachable";

export type RoundReport = {
  roundId: string;
  ranAt: string;
  considered: number;
  sent: number;
  failed: number;
  unchanged: number;
  nothingOwed: number;
  unreachable: number;
};

/**
 * Whether this message is worth sending, given the last one that reached them.
 *
 * Pure, and separate from the sending, because this is the whole rule of the
 * increment and a reader should be able to check it without reading a
 * transaction.
 */
export function worthSending(
  body: string,
  last: { body: string; at: Date } | null,
  at: Date,
  resendAfterMs: number = RESEND_AFTER_MS
): boolean {
  // Nobody has ever been told.
  if (last === null) return true;
  // It says something different from what they were last told.
  if (last.body !== body) return true;
  // It says the same thing, and saying it once a week is what stops an ignored
  // debt going quiet.
  return at.getTime() - last.at.getTime() >= resendAfterMs;
}

/** Whose debts this person would be sent: the accountant's seat, or the practice's. */
function seatOf(role: string, entitlements: string[]): NoticeSeat {
  const known = isRole(role) ? role : undefined;
  return known && isCpaSeat({ role: known, entitlements }) ? "accountant" : "owner";
}

export type RoundInput = {
  tenantId: string;
  practiceName: string;
  appUrl: string;
  transport: Transport;
  at?: Date;
  pause?: (ms: number) => Promise<void>;
  resendAfterMs?: number;
};

/**
 * One round for one practice: everybody with an address in force is considered,
 * and each of them becomes exactly one outcome.
 *
 * Somebody who withdrew is not considered at all. They decided that, and
 * counting them among the people this round could not reach would file a
 * decision as a failure.
 */
export async function runNoticeRound(db: AppDb, input: RoundInput): Promise<RoundReport> {
  const at = input.at ?? new Date();
  const notices = await collectOutstanding(db, input.tenantId);

  // Everybody who has ever said where to send. Their current address decides
  // whether they are considered, and `currentAddress` is where newest-row-wins
  // lives; re-deriving it in one clever query here would be a second copy of
  // that rule, and the two would disagree the first time one changed.
  const everSaid = await db
    .selectDistinct({ userId: noticeAddresses.userId })
    .from(noticeAddresses)
    .where(eq(noticeAddresses.tenantId, input.tenantId));

  const counts = { sent: 0, failed: 0, unchanged: 0, nothingOwed: 0, unreachable: 0 };
  let considered = 0;

  for (const { userId } of everSaid) {
    const held = await currentAddress(db, input.tenantId, userId);
    if (held === null || held.address === null) continue;
    considered += 1;

    const person = (
      await db
        .select({ displayName: users.displayName, role: users.role })
        .from(users)
        .where(and(eq(users.tenantId, input.tenantId), eq(users.id, userId)))
        .limit(1)
    )[0];
    if (!person) {
      // An address whose person is gone. Nothing to send and nobody to send it
      // to, and a round that counted it as unreachable would report a person
      // this practice does not have.
      considered -= 1;
      continue;
    }

    const grants = await db
      .select({ entitlement: userEntitlements.entitlement })
      .from(userEntitlements)
      .where(
        and(
          eq(userEntitlements.tenantId, input.tenantId),
          eq(userEntitlements.userId, userId),
          or(isNull(userEntitlements.effectiveTo), eq(userEntitlements.entitlement, CPA_SEAT_ENTITLEMENT))
        )
      );
    const seat = seatOf(
      person.role,
      grants.map((g) => g.entitlement)
    );

    // Built here only to be compared. `sendNotices` builds it again from the
    // same pure function on the same inputs inside the same transaction, so
    // what was weighed is what goes out.
    const message = renderMessage({ practiceName: input.practiceName, seat, notices, appUrl: input.appUrl });
    if (message === null) {
      counts.nothingOwed += 1;
      continue;
    }

    const last = await lastDelivered(db, input.tenantId, userId);
    if (!worthSending(message.body, last, at, input.resendAfterMs)) {
      // Nothing happened, so nothing is written. The round's own row carries
      // the count, which is where a reader looks for "what did the sender do".
      counts.unchanged += 1;
      continue;
    }

    const result = await sendNotices(db, {
      tenantId: input.tenantId,
      recipientId: userId,
      recipientName: person.displayName,
      seat,
      practiceName: input.practiceName,
      appUrl: input.appUrl,
      notices,
      transport: input.transport,
      at: input.at,
      pause: input.pause,
    });
    if (result.outcome === "sent") counts.sent += 1;
    else if (result.outcome === "failed") counts.failed += 1;
    else if (result.outcome === "unreachable") counts.unreachable += 1;
    else counts.nothingOwed += 1;
  }

  const roundId = uuidv7();
  await db.insert(noticeRounds).values({
    id: roundId,
    tenantId: input.tenantId,
    ranAt: at,
    considered,
    sent: counts.sent,
    failed: counts.failed,
    unchanged: counts.unchanged,
    nothingOwed: counts.nothingOwed,
    unreachable: counts.unreachable,
  });
  // The chain carries the act with nobody as its actor, because nobody did it.
  await appendControlEvent(db, input.tenantId, null, "notice.round_ran", { ...counts, considered }, at);

  return { roundId, ranAt: at.toISOString(), considered, ...counts, nothingOwed: counts.nothingOwed };
}

/** The last round this practice ran, or null where none has. */
export async function lastRound(db: AppDb, tenantId: string): Promise<RoundReport | null> {
  const rows = await db
    .select()
    .from(noticeRounds)
    .where(eq(noticeRounds.tenantId, tenantId))
    .orderBy(desc(noticeRounds.ranAt), desc(noticeRounds.id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    roundId: row.id,
    ranAt: row.ranAt.toISOString(),
    considered: row.considered,
    sent: row.sent,
    failed: row.failed,
    unchanged: row.unchanged,
    nothingOwed: row.nothingOwed,
    unreachable: row.unreachable,
  };
}
