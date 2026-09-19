import { attestationCoverage, lastCompleteMonth, type AttestationCoverage } from "../controls/attestationCoverage";
import { ATTESTABLE_CHANNELS, listMonthAttestations } from "../controls/attestations";
import { listDecisions } from "../controls/decisions";
import type { AppDb } from "../db/client";
import { allThreadsUnlabelled } from "../cpa/questions";
import { latestReads, unreadFor } from "../cpa/threadReads";
import { decisionsDue } from "../home/board";
import type { Thread } from "../cpa/questions";
import type { DecisionDue } from "../home/board";

/**
 * One list of what each seat is owed (Increment 1.57).
 *
 * Everything this arc built since Increment 1.52 is read rather than sent, and
 * each thing is read on its own screen: the unattested channels on the owner
 * board, the unanswered questions on the same board, the unread answers on
 * `/cpa`, the decisions due on the board again. Nobody can answer "what does
 * this practice owe right now, and who owes it" without visiting all of them
 * and holding the answer in their head.
 *
 * Three commitments shape this, and each is a rule the rest of the product
 * already keeps.
 *
 * **Nothing is stored.** A notices table would be a status column that can
 * disagree with the rows under it — the thing this codebase refuses from the
 * owner board's counts to the thread's `awaitingPractice`. So the list is
 * derived from the same readings the screens use, on every read, and an
 * entry cannot outlive the fact it reports.
 *
 * **Each notice carries the sentence its own surface already wrote.** A second
 * wording for one fact is two things to keep true; one of them eventually is
 * not. This is the rule Increment 1.52 settled for attestation coverage and
 * Increment 1.54 repeated for a closed month, applied across the whole set.
 *
 * **A notice names who owes the doing.** The owner cannot discharge the
 * accountant's reading and the accountant cannot answer the practice's
 * question, so a list that mixed them would be a list nobody could act on.
 *
 * Increment 1.58 added a fourth, which the first three made necessary rather
 * than optional: **a notice says one thing on a screen and another outside the
 * product.** Two of the four kinds here carry a person's typed words verbatim,
 * because Increment 1.50 chose the question's own words over a resolved label.
 * Behind a guard that is right. In a message that leaves the product it is not:
 * nothing constrains what somebody types into a thread, and the whole reason
 * the outside accountant's seat needs no BAA is that what it can reach names no
 * patient. So every notice carries `outside` as well as `sentence`, and
 * `outside` is always generated here from months, dates and codes.
 */

export type NoticeSeat = "owner" | "accountant";

export type Notice = {
  /** Stable within a practice, so two readings of one state are one notice. */
  key: string;
  /** Who is owed the doing; never merely who may read it. */
  seat: NoticeSeat;
  /** A few words naming the thing, for a heading. */
  subject: string;
  /** The sentence the thing's own surface already says, never a second wording. */
  sentence: string;
  /**
   * What this notice may say outside the product, where no guard follows it.
   *
   * Always generated here from months, dates and codes — never a person's typed
   * words, which `sentence` may carry and which nothing in the product
   * constrains. `renderMessage` is typed so that it cannot read `sentence` at
   * all, which is what makes this a rule rather than a promise.
   */
  outside: string;
  /** Where the doing happens. */
  href: string;
  /** The day this became owed, where the rows know it; null where they do not. */
  since: string | null;
};

export type OutstandingInput = {
  /** Who has vouched for the channels the product cannot enforce, for the month that has ended. */
  attestations: AttestationCoverage;
  /** Threads the accountant opened that the practice has not answered. */
  awaitingPractice: Thread[];
  /** Threads the practice has answered that the accountant has not marked read. */
  unreadByAccountant: Thread[];
  /** Active decisions whose review date has passed. */
  decisionsDue: DecisionDue[];
};

/**
 * Folds the readings into one list, owner's debts first and, within a seat,
 * oldest first — because the thing owed longest is the thing least likely to
 * be discharged by somebody noticing it on a screen.
 */
export function outstandingNotices(input: OutstandingInput): Notice[] {
  const notices: Notice[] = [];

  // Increment 1.52's coverage, in its own words. A month with nothing to
  // attest is complete, so this adds nothing rather than a reassuring row.
  if (!input.attestations.complete) {
    notices.push({
      key: `attestation:${input.attestations.month}`,
      seat: "owner",
      subject: `Channels nobody reviewed for ${input.attestations.month}`,
      sentence: input.attestations.sentence,
      // Increment 1.52 builds this from the channel list and the names of the
      // people who vouched, so it names no patient and may leave the product.
      outside: input.attestations.sentence,
      href: "/cpa",
      since: null,
    });
  }

  for (const t of input.awaitingPractice) {
    const asked = t.messages[0];
    notices.push({
      key: `question:${t.id}`,
      seat: "owner",
      subject: `A question about ${t.month}`,
      // The question's own words, which is what Increment 1.50 put on the board
      // rather than a resolved label: one label costs a whole month's package.
      sentence: asked?.body ?? "",
      // Outside, the act and not the words: a question is typed by a person and
      // may say anything at all, including a patient's name.
      outside: `The accountant asked about ${t.month} on ${t.askedAt.slice(0, 10)}. The question itself is on the owner board.`,
      href: "/home",
      since: t.askedAt.slice(0, 10),
    });
  }

  for (const t of input.unreadByAccountant) {
    const last = t.messages[t.messages.length - 1];
    notices.push({
      key: `unread:${t.id}`,
      seat: "accountant",
      subject: `An answer about ${t.month}`,
      sentence: last?.body ?? "",
      // Typed by the practice, so outside it is the act and not the words.
      outside: `The practice answered about ${t.month} on ${t.lastAt.slice(0, 10)}. The answer itself is on the month-end screen.`,
      href: "/cpa",
      since: t.lastAt.slice(0, 10),
    });
  }

  for (const d of input.decisionsDue) {
    if (!d.overdue) continue;
    notices.push({
      key: `decision:${d.id}`,
      seat: "owner",
      subject: `A decision past its review date`,
      // The board carries no single sentence for an overdue decision, so this
      // is a first wording rather than a second, built from the row's own
      // fields: the kind, who decided it, and the date it was due.
      sentence: `${d.kindLabel}, recorded by ${d.decidedByName} on ${d.decidedAt.slice(0, 10)}, was due for review on ${d.reviewBy}.`,
      // Built from the row's own fields rather than from anything typed, so the
      // screen's sentence and the outside one are the same sentence.
      outside: `${d.kindLabel}, recorded by ${d.decidedByName} on ${d.decidedAt.slice(0, 10)}, was due for review on ${d.reviewBy}.`,
      href: "/home",
      since: d.reviewBy,
    });
  }

  const seatOrder: Record<NoticeSeat, number> = { owner: 0, accountant: 1 };
  return notices.sort((a, b) => {
    if (a.seat !== b.seat) return seatOrder[a.seat] - seatOrder[b.seat];
    // Oldest first; a notice whose rows do not date it sorts after those that do.
    if (a.since === b.since) return a.key < b.key ? -1 : 1;
    if (a.since === null) return 1;
    if (b.since === null) return -1;
    return a.since < b.since ? -1 : 1;
  });
}

/** What each seat owes, for a heading that says so without counting twice. */
export function countBySeat(notices: Notice[]): Record<NoticeSeat, number> {
  return {
    owner: notices.filter((n) => n.seat === "owner").length,
    accountant: notices.filter((n) => n.seat === "accountant").length,
  };
}

/**
 * Gathers the readings and folds them, in one transaction.
 *
 * Every source here is a reader that already exists and is already the single
 * definition of its fact; this adds no second query for any of them and no
 * table of its own.
 */
export async function collectOutstanding(db: AppDb, tenantId: string, asOf: string = new Date().toISOString().slice(0, 10)): Promise<Notice[]> {
  const month = lastCompleteMonth(asOf);
  const threads = await allThreadsUnlabelled(db, tenantId);
  const reads = await latestReads(db, tenantId, "accountant");
  return outstandingNotices({
    attestations: attestationCoverage({
      month,
      channels: ATTESTABLE_CHANNELS,
      attested: (await listMonthAttestations(db, tenantId, month))
        .filter((r) => r.attestation !== null)
        .map((r) => ({ channel: r.channel, seat: r.attestation!.seat as string, byName: r.attestation!.byName })),
    }),
    awaitingPractice: threads.filter((t) => t.awaitingPractice),
    unreadByAccountant: threads.filter((t) => unreadFor(t, "accountant", reads.get(t.id))),
    decisionsDue: decisionsDue(await listDecisions(db, tenantId), asOf),
  });
}
