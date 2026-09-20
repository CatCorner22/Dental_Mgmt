import { and, desc, eq, isNull, or } from "drizzle-orm";
import { noticeRounds, users, userEntitlements, noticeAddresses, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { isRole } from "../auth/roles";
import { CPA_SEAT_ENTITLEMENT, isCpaSeat } from "../auth/seats";
import { currentAddress } from "./addresses";
import { REPROVE_WINDOW_MS, currentProof, proofLapsesAt, proofStanding, sendProofCode } from "./proof";
import { renderMessage } from "./message";
import { collectOutstanding, type NoticeSeat } from "./outstanding";
import { computeDigest, loadDigestAck, periodEnding } from "../digest/digest";
import { listMonthCloses } from "../cpa/close";
import { computeMonthPackage } from "../cpa/package";
import { renderPackageMessage } from "./packageMessage";
import { renderDigestMessage } from "./digestMessage";
import { deliverMessage, lastDelivered, sendNotices } from "./send";
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
 *
 * **The week's digest rides the same round on a different rule**
 * (Increment 1.64). It answers a different question — "has a week passed?" —
 * and its counts move every day, so the change-or-stale rule above would turn
 * it into a daily message, which is precisely the noise that rule exists to
 * prevent. One digest per completed week per person, and "once" is answered by
 * the message itself: the last digest that reached them is older than the week
 * now being reported, or there has not been one.
 */

/** How long a message that still stands waits before it is sent again. */
export const RESEND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The seven days ending on the most recent Sunday strictly before this moment.
 *
 * A fixed boundary rather than a rolling window, because a rolling one would
 * name a different week on Monday than on Tuesday, and a message whose subject
 * changed daily would be a new message daily. Sunday is the boundary a practice
 * can say out loud.
 */
export function lastCompleteWeek(at: Date): { start: string; end: string; endAt: Date } {
  const day = at.getUTCDay();
  // Sunday is 0, so a Monday (1) steps back one day and a Sunday steps back seven.
  const backToSunday = day === 0 ? 7 : day;
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() - backToSunday));
  const period = periodEnding(end.toISOString().slice(0, 10));
  return { start: period.start, end: period.end, endAt: period.endAt };
}

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
  /** A second axis over the same people: the week's digest (Increment 1.64). */
  digestsSent: number;
  digestsFailed: number;
  /** A third: the month-end package, told to the accountant (Increment 1.66). */
  packagesSent: number;
  packagesFailed: number;
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
  const digests = { sent: 0, failed: 0 };
  const packages = { sent: 0, failed: 0 };
  let considered = 0;

  /**
   * The week's digest, computed once for the practice rather than per person,
   * because every count in it is the practice's: it carries no person
   * dimension, which is what makes it safe to send at all.
   */
  const week = lastCompleteWeek(at);
  const period = periodEnding(week.end);
  const digestFacts = await (async () => {
    const digest = await computeDigest(db, input.tenantId, period);
    const ack = await loadDigestAck(db, input.tenantId, week.end);
    return {
      practiceName: input.practiceName,
      period: { start: week.start, end: week.end },
      appUrl: input.appUrl,
      postings: digest.money.postingCount,
      approvalsRequested: digest.approvals.requested,
      afterHoursHolds: digest.alerts.afterHoursHolds,
      findingsOpened: digest.findings.opened.reduce((n, r) => n + r.count, 0),
      findingsOpenNow: digest.findings.openNow,
      decisionsOverdueNow: digest.decisions.overdueNow,
      postingsIntoSealedDays: digest.bank.postingsIntoSealedDays,
      acknowledged: ack !== null,
    };
  })();

  /**
   * The month this practice closed most recently, and what a message would say
   * about it (Increment 1.66). Computed once for the practice, like the digest,
   * and only when there is a close to speak of.
   */
  const closes = await listMonthCloses(db, input.tenantId);
  const newestClose = closes.reduce<(typeof closes)[number] | null>(
    (best, c) => (best === null || c.closedAt > best.closedAt ? c : best),
    null
  );
  const packageFacts =
    newestClose === null
      ? null
      : {
          practiceName: input.practiceName,
          month: newestClose.month,
          packageHash: newestClose.packageHash,
          packageSchema: newestClose.packageSchema,
          entryCount: newestClose.entryCount,
          closedAt: newestClose.closedAt,
          appUrl: input.appUrl,
          // Label and whether it holds. The detail carries figures, so it stays
          // behind the guard.
          tieOuts: (await computeMonthPackage(db, input.tenantId, newestClose.month)).tieOut.map((t) => ({
            label: t.label,
            holds: t.holds,
          })),
        };

  /**
   * Tells the accountant that a month closed, once per close.
   *
   * The accountant's seat only: this is the artefact that seat exists for, and
   * the practice's own people read the close on the screen they already open.
   *
   * "Once" is answered by the message itself, as the digest's is — the last
   * package message that reached this person is older than the close now being
   * reported, or there has not been one. No column records which month was
   * told, because a close has a time and a message has a time.
   */
  const maybeSendPackage = async (
    userId: string,
    displayName: string,
    seat: NoticeSeat,
    address: string,
    proved: boolean
  ): Promise<void> => {
    if (seat !== "accountant" || packageFacts === null || !proved) return;
    const last = await lastDelivered(db, input.tenantId, userId, "package");
    if (last !== null && last.at >= new Date(packageFacts.closedAt)) return;

    const { record } = await deliverMessage(db, {
      tenantId: input.tenantId,
      kind: "package",
      recipientId: userId,
      recipientName: displayName,
      seat,
      message: renderPackageMessage(packageFacts),
      noticeCount: 1,
      address,
      why: null,
      transport: input.transport,
      at: input.at,
      pause: input.pause,
    });
    if (record.outcome === "sent") packages.sent += 1;
    else packages.failed += 1;
  };

  /**
   * The week's digest for one person, on its own rule.
   *
   * It goes to the owner seat only: the digest is the practice's week, and the
   * outside accountant's seat reaches the month-end package and nothing else
   * (Increment 1.49) — a weekly operations summary is not theirs to receive.
   *
   * Once per completed week, answered by the message itself: the last digest
   * that reached this person is older than the week now being reported, or
   * there has not been one. No column records which week was sent, because a
   * digest is only ever sent after its week has ended, so the timestamp already
   * says which week it was.
   */
  const maybeSendDigest = async (
    userId: string,
    displayName: string,
    seat: NoticeSeat,
    address: string,
    proved: boolean
  ): Promise<void> => {
    if (seat !== "owner") return;
    // An unproved address is not a destination for a digest either. It is not
    // counted as unreachable: that count is about the notices, and a person
    // whose address is unproved already reads that on their own row.
    if (!proved) return;
    const last = await lastDelivered(db, input.tenantId, userId, "digest");
    if (last !== null && last.at >= week.endAt) return;

    const { record } = await deliverMessage(db, {
      tenantId: input.tenantId,
      kind: "digest",
      recipientId: userId,
      recipientName: displayName,
      seat,
      message: renderDigestMessage(digestFacts),
      noticeCount: 1,
      address,
      why: null,
      transport: input.transport,
      at: input.at,
      pause: input.pause,
    });
    if (record.outcome === "sent") digests.sent += 1;
    else digests.failed += 1;
  };

  /**
   * Asks for a new code while a proof is inside its last thirty days.
   *
   * Before the lapse rather than after it, because a proof that expired in
   * silence would stop the notices with no warning — and stopping without
   * saying so is the failure this whole arc refuses. One ask per window, which
   * is answered the same way the digest's is: has a code reached this person
   * since the window opened?
   */
  const maybeAskToReprove = async (
    userId: string,
    displayName: string,
    seat: NoticeSeat,
    proof: { provedAt: string } | null
  ): Promise<void> => {
    if (proof === null || proofStanding(proof, at) !== "expiring") return;
    const windowOpened = new Date(new Date(proofLapsesAt(proof)).getTime() - REPROVE_WINDOW_MS);
    const lastCode = await lastDelivered(db, input.tenantId, userId, "proof_code");
    if (lastCode !== null && lastCode.at >= windowOpened) return;
    await sendProofCode(db, {
      tenantId: input.tenantId,
      userId,
      userName: displayName,
      seat,
      practiceName: input.practiceName,
      appUrl: input.appUrl,
      transport: input.transport,
      at: input.at,
      pause: input.pause,
      // The round is not a person pressing a button, and the address is one
      // this person already proved, so the limit on asking has no stranger to
      // protect here.
      unlimited: true,
    });
  };

  for (const { userId } of everSaid) {
    const held = await currentAddress(db, input.tenantId, userId);
    if (held === null || held.address === null) continue;
    considered += 1;
    const proofNow = await currentProof(db, input.tenantId, held.id);
    // A lapsed proof is no proof: an address nobody has confirmed in a year is
    // not a destination, and it refuses exactly as a never-proved one does
    // rather than earning an outcome of its own.
    const standing = proofStanding(proofNow, at);
    const proved = standing === "good" || standing === "expiring";

    const person = (
      await db
        .select({ displayName: users.displayName, role: users.role, active: users.active })
        .from(users)
        .where(and(eq(users.tenantId, input.tenantId), eq(users.id, userId)))
        .limit(1)
    )[0];
    // An address whose person is gone, or who has left the practice.
    //
    // The second was a defect until Increment 1.65: a deactivated account kept
    // receiving the practice's notices, at an address nobody had revisited,
    // which is the same silent delivery to a mailbox nobody reads that the
    // proof exists to prevent — and worse, because the person is known to have
    // gone. Neither is counted as unreachable: that count is about people this
    // round could not reach, and these are people it must not reach.
    if (!person || !person.active) {
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

    /**
     * This person's notices, and the two ways there are none to send.
     *
     * A defect until Increment 1.66: both of those ways used to leave the loop
     * outright, which silently took the digest and the package with them — so
     * a seat that owed nothing received neither, and owing nothing is the
     * ordinary case for both. A decision about the notices now ends only the
     * notices.
     */
    const sendTheNotices = async (): Promise<void> => {
      if (message === null) {
        counts.nothingOwed += 1;
        return;
      }
      const last = await lastDelivered(db, input.tenantId, userId);
      if (!worthSending(message.body, last, at, input.resendAfterMs)) {
        // Nothing happened, so nothing is written. The round's own row carries
        // the count, which is where a reader looks for "what did the sender do".
        counts.unchanged += 1;
        return;
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
    };

    await sendTheNotices();
    await maybeSendDigest(userId, person.displayName, seat, held.address, proved);
    await maybeAskToReprove(userId, person.displayName, seat, proofNow);
    await maybeSendPackage(userId, person.displayName, seat, held.address, proved);
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
    digestsSent: digests.sent,
    digestsFailed: digests.failed,
    packagesSent: packages.sent,
    packagesFailed: packages.failed,
  });
  // The chain carries the act with nobody as its actor, because nobody did it.
  await appendControlEvent(
    db,
    input.tenantId,
    null,
    "notice.round_ran",
    {
      ...counts,
      considered,
      digestsSent: digests.sent,
      digestsFailed: digests.failed,
      packagesSent: packages.sent,
      packagesFailed: packages.failed,
    },
    at
  );

  return {
    roundId,
    ranAt: at.toISOString(),
    considered,
    ...counts,
    nothingOwed: counts.nothingOwed,
    digestsSent: digests.sent,
    digestsFailed: digests.failed,
    packagesSent: packages.sent,
    packagesFailed: packages.failed,
  };
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
    digestsSent: row.digestsSent,
    digestsFailed: row.digestsFailed,
    packagesSent: row.packagesSent,
    packagesFailed: row.packagesFailed,
  };
}
