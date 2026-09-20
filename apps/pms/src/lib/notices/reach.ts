import { and, eq } from "drizzle-orm";
import { noticeAddresses, users, userEntitlements } from "@pms/db";
import type { AppDb } from "../db/client";
import { currentAddress } from "./addresses";
import { currentProof, proofLapsesAt, proofStanding } from "./proof";
import { afterLapse, readCodesFrom } from "./retirement";
import { codesSentSince } from "./send";
import { seatOf, type NoticeSeat } from "./outstanding";
import { addressRefusal } from "./stop";

/**
 * Who the practice believes it is notifying, and is not (Increment 1.69).
 *
 * Increment 1.68 had the round keep asking after a proof lapses and then let
 * the address go. But **the asking is the only telling, and it goes to the
 * mailbox that is failing.** The person sees it on their own screen if they
 * sign in; nobody else learns anything at all. A practice can therefore run
 * for months believing all of its people are being told, while one of them is
 * not — which is the same silent success this arc has been closing since
 * Increment 1.59, met one level up: not a message that failed, but a person
 * the product quietly stopped reaching.
 *
 * **A standing reading, not a change feed.** "Who became unreachable last
 * week" would name a person once and then go quiet, so the longer somebody had
 * been unreachable the less the practice would hear about it — exactly the
 * decay this arc refuses. What the owner needs is who cannot be reached *now*.
 *
 * **It names the person and never the address.** Increment 1.58 settled that
 * where somebody is reachable is theirs; the practice needs to know that Riley
 * cannot be reached, not what Riley typed.
 *
 * **It reads only people who have an address in force.** Somebody who never
 * gave one is not a broken promise — no message was ever expected, and their
 * own screen says so. What belongs here is the practice holding a destination
 * that is not one.
 *
 * **A person who has left is not counted.** Increment 1.65 stopped sending to
 * a deactivated account; somebody the product must not reach is not somebody
 * it cannot reach, and filing one as the other would report a rule working as
 * a fault.
 *
 * **It never enters a message.** This rides beside the weekly digest and on
 * the owner's board, both behind a guard. The digest's own counts name nobody,
 * because a digest leaves the product (Increment 1.64); this does not, and the
 * route adds it beside `computeDigest` rather than inside it — which is also
 * what keeps a closed month's hash still, for the reason Increment 1.53 set
 * out.
 */

/** Why the product cannot reach somebody who has an address on file. */
export type ReachProblem = "refused" | "retired" | "lapsed" | "unproved";

export type Unreachable = {
  userId: string;
  name: string;
  seat: NoticeSeat;
  why: ReachProblem;
  /** The day the trouble started, as a calendar date. */
  since: string;
  /** One sentence, written once so the board and the digest cannot drift apart. */
  sentence: string;
};

export type ReachReading = {
  /** Everybody with an address in force whom the product cannot reach. */
  unreachable: Unreachable[];
  /**
   * How many people have an address in force at all.
   *
   * Carried so that an empty list reads as measured rather than as missing: a
   * card that says nothing when it has nothing to say is indistinguishable
   * from a card that broke, which is the rule Increment 1.52 wrote down.
   */
  considered: number;
  asOf: string;
};

/**
 * One reader's sentence for one problem.
 *
 * Pure, and the only wording there is. Increment 1.52 established that a
 * reading shown in two places comes from one function rather than from two
 * sentences that could drift; this is read on the board and beside the digest.
 */
export function reachSentence(input: {
  name: string;
  why: ReachProblem;
  since: string;
  /** Codes that went unanswered after the lapse, where that is what happened. */
  asked?: number;
  /** When the practice stops asking, where it is still asking. */
  stopsOn?: string;
}): string {
  const day = input.since.slice(0, 10);
  switch (input.why) {
    case "refused":
      return `Somebody reading ${input.name}'s address said on ${day} that they did not ask for this practice's messages. Nothing goes there, and that address cannot be saved again.`;
    case "retired":
      return `${input.name}'s address stopped being a destination on ${day}, after ${input.asked ?? 0} codes went unanswered. They receive nothing until they save an address again and prove it.`;
    case "lapsed":
      return `The proof that ${input.name}'s address reaches them lapsed on ${day}, so nothing is sent to it. The practice is still asking for a code${input.stopsOn ? `, and stops on ${input.stopsOn.slice(0, 10)}` : ""}.`;
    case "unproved":
      return `Nobody has proved that the address ${input.name} saved on ${day} reaches them, so nothing is sent to it.`;
  }
}

/**
 * Everybody the practice cannot reach, read from rows on every call.
 *
 * Derived and stored nowhere, which is the same argument Increments 1.65 and
 * 1.68 made about a proof's life and an address's retirement: a column here
 * would be a status the rows under it could contradict, and it would have to
 * be kept in step by something that remembers to run.
 */
export async function readReach(db: AppDb, tenantId: string, at: Date = new Date()): Promise<ReachReading> {
  const everSaid = await db
    .selectDistinct({ userId: noticeAddresses.userId })
    .from(noticeAddresses)
    .where(eq(noticeAddresses.tenantId, tenantId));

  const unreachable: Unreachable[] = [];
  let considered = 0;

  for (const { userId } of everSaid) {
    const held = await currentAddress(db, tenantId, userId);
    // A withdrawal is a decision, not a fault (Increment 1.58), so it is not
    // considered at all — counting it would file somebody's own choice as a
    // failure to reach them.
    if (held === null || held.address === null) continue;

    const person = (
      await db
        .select({ displayName: users.displayName, role: users.role, active: users.active })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
        .limit(1)
    )[0];
    if (!person || !person.active) continue;
    considered += 1;

    const grants = await db
      .select({ entitlement: userEntitlements.entitlement })
      .from(userEntitlements)
      .where(and(eq(userEntitlements.tenantId, tenantId), eq(userEntitlements.userId, userId)));
    const seat = seatOf(
      person.role,
      grants.map((g) => g.entitlement)
    );
    const name = person.displayName;

    // The states rank, and the strongest is the one to report: a refusal is
    // the mailbox's own word and outranks anything the practice believes, a
    // retirement outranks the lapse it grew out of, and a lapse outranks the
    // absence of a proof it used to have.
    const refused = await addressRefusal(db, tenantId, held.address);
    if (refused !== null) {
      const since = refused.refusedAt;
      unreachable.push({ userId, name, seat, why: "refused", since, sentence: reachSentence({ name, why: "refused", since }) });
      continue;
    }

    const proof = await currentProof(db, tenantId, held.id);
    const standing = proofStanding(proof, at);
    if (standing === "good" || standing === "expiring") continue;

    if (standing === "none") {
      const since = held.setAt;
      unreachable.push({ userId, name, seat, why: "unproved", since, sentence: reachSentence({ name, why: "unproved", since }) });
      continue;
    }

    const lapsedAt = proofLapsesAt(proof!);
    const after = afterLapse(lapsedAt, await codesSentSince(db, tenantId, userId, readCodesFrom(lapsedAt)), at);
    if (after.retired) {
      unreachable.push({
        userId,
        name,
        seat,
        why: "retired",
        since: after.retiredAt,
        sentence: reachSentence({ name, why: "retired", since: after.retiredAt, asked: after.asked }),
      });
    } else {
      unreachable.push({
        userId,
        name,
        seat,
        why: "lapsed",
        since: lapsedAt,
        sentence: reachSentence({ name, why: "lapsed", since: lapsedAt, stopsOn: after.retiresAt }),
      });
    }
  }

  // Newest trouble last: a reader scanning the list meets the oldest silence
  // first, which is the one that has gone unnoticed longest.
  unreachable.sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : a.name.localeCompare(b.name)));
  return { unreachable, considered, asOf: at.toISOString() };
}
