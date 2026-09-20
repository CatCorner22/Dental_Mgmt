import { and, eq } from "drizzle-orm";
import { users, userEntitlements } from "@pms/db";
import type { AppDb } from "../db/client";
import { navLinksFor, type Seat } from "../auth/seats";
import { isRole } from "../auth/roles";
import { currentAddress } from "./addresses";
import { NOTICE_PLACES, seatOf, type NoticeSeat } from "./outstanding";

/**
 * Who the practice was never set up to reach (Increment 1.70).
 *
 * Increment 1.69 reports who is set up and broken: an address on file that
 * refuses, retires, lapses or was never proved. It reads only people who have
 * an address in force, and said so — somebody who never gave one "is not a
 * broken promise". That is true of the *address*, and it hides a plainer
 * failure one step earlier: **a person the product would send to, who never
 * told it where.** Nothing fails, nothing is refused, and nobody learns
 * anything. It is the same silent success this arc has been closing since
 * Increment 1.59, at the only place left that it could still hide.
 *
 * **The hard half is who counts, not how to read it.** A card listing everybody
 * on the roster without an address is a card nobody reads: most of a practice's
 * people are not sent anything, and a list that is mostly fine teaches a reader
 * to skip it. So the reading answers a narrower question — **who could act on
 * what a notice says?** — and it answers it from the guards rather than from a
 * rank written down here. Every notice names where the doing happens
 * (Increment 1.57), and what opens that screen is what `navLinksFor` opens. A
 * person who cannot open `/home` cannot discharge an overdue decision, so the
 * practice does not need an address for them; a manager and the outside
 * accountant can, so it does.
 *
 * **Having an address stays anybody's to choose.** Increment 1.58 settled that
 * where somebody is reachable is theirs, and the round sends to whoever saved
 * one. This does not narrow that. It reports the converse and only the
 * converse: somebody the practice *needs* to be able to reach and cannot.
 *
 * **A withdrawal is still a decision, not an absence.** Increment 1.69's rule
 * holds here, and it costs something to hold: a manager who withdrew is a
 * manager the practice cannot reach. So the reading counts them and names them
 * as withdrawn rather than either filing a decision as a fault or passing over
 * it in silence.
 *
 * **It acts on nothing.** No message, no finding, no decision — the practice
 * knowing is the whole of what was missing, which is the shape Increment 1.69
 * chose for the same reason. It rides the same two surfaces, behind the same
 * guard, and never enters the digest message: this names people, and a message
 * that leaves the product names nobody (Increment 1.64).
 */

/** Somebody the practice would send to, and what it knows about where. */
export type NotSetUp = {
  userId: string;
  name: string;
  seat: NoticeSeat;
  /** One sentence, written once so the board and the digest cannot drift apart. */
  sentence: string;
};

export type SetupReading = {
  /** People who could act on their seat's notices and have never said where to send them. */
  missing: NotSetUp[];
  /** People who could act on their seat's notices and decided to receive nothing. */
  withdrawn: NotSetUp[];
  /**
   * How many people could act on a seat's notices at all.
   *
   * Carried for the reason Increment 1.52 wrote down and Increment 1.69
   * repeated: an empty list has to read as measured rather than as missing, and
   * a card that says nothing when it has nothing to say is indistinguishable
   * from a card that broke.
   */
  expected: number;
  asOf: string;
};

/**
 * Whether the practice needs to be able to reach this person.
 *
 * Pure, and derived from the guards rather than from a rank named here: a
 * person is sent a seat's notices to act on, and what lets them act is what
 * opens the screen the notices point at. A rank written into this file would be
 * a second answer to a question `seats.ts` already answers, and the two would
 * disagree the first time a screen moved.
 *
 * The entitlements are read the way a sign-in reads them — every grant on the
 * row, unexpired or not — because that is what decides which links a session
 * actually opens, and a reading that used a stricter set would report somebody
 * as needing no address while their own screen offered them one.
 */
export function needsAnAddress(seat: Seat): boolean {
  const opens = new Set(navLinksFor(seat).map((link) => link.href));
  return NOTICE_PLACES[seatOf(seat.role, seat.entitlements)].some((place) => opens.has(place));
}

/** One reader's sentence for one person. Pure, and the only wording there is. */
export function setupSentence(input: { name: string; seat: NoticeSeat; withdrawn: boolean }): string {
  const who =
    input.seat === "accountant"
      ? `${input.name} holds the outside accountant's seat`
      : `${input.name} can act on what this practice is told`;
  return input.withdrawn
    ? `${who}, and has chosen to receive nothing. That is their decision, and it means the practice cannot tell them anything.`
    : `${who}, and has never said where to send their notices. Nothing has ever been sent to them, and nothing will be until they save an address and prove it.`;
}

/**
 * Everybody the practice needs to be able to reach, and what it knows about
 * where — read from rows on every call.
 *
 * Derived and stored nowhere, for the reason Increments 1.65, 1.68 and 1.69
 * each gave: a column here would be a status the rows under it could
 * contradict, kept in step by something that remembers to run.
 */
export async function readSetup(db: AppDb, tenantId: string, at: Date = new Date()): Promise<SetupReading> {
  const roster = await db
    .select({ id: users.id, displayName: users.displayName, role: users.role })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.active, true)));

  // One read for the whole practice rather than one per person: this walks the
  // roster, where Increment 1.69 walked only the people who had said something.
  const grants = await db
    .select({ userId: userEntitlements.userId, entitlement: userEntitlements.entitlement })
    .from(userEntitlements)
    .where(eq(userEntitlements.tenantId, tenantId));
  const held = new Map<string, string[]>();
  for (const g of grants) held.set(g.userId, [...(held.get(g.userId) ?? []), g.entitlement]);

  const missing: NotSetUp[] = [];
  const withdrawn: NotSetUp[] = [];
  let expected = 0;

  for (const person of roster) {
    // Somebody who has left is not counted, as Increment 1.65 settled and 1.69
    // repeated: a person the product must not reach is not one it cannot
    // reach. The query above asks the database for that rather than filtering
    // here, so an inactive row cannot reach the rest of this loop.
    if (!isRole(person.role)) continue;
    const seat: Seat = { role: person.role, entitlements: held.get(person.id) ?? [] };
    if (!needsAnAddress(seat)) continue;
    expected += 1;

    const address = await currentAddress(db, tenantId, person.id);
    if (address !== null && address.address !== null) continue;

    const mine = seatOf(seat.role, seat.entitlements);
    const gone = address !== null;
    const row: NotSetUp = {
      userId: person.id,
      name: person.displayName,
      seat: mine,
      sentence: setupSentence({ name: person.displayName, seat: mine, withdrawn: gone }),
    };
    (gone ? withdrawn : missing).push(row);
  }

  // The accountant's seat first and then by name: the package is the one thing
  // this product sends outside itself, so an accountant nobody can reach is the
  // entry a reader should meet first.
  const order = (a: NotSetUp, b: NotSetUp) =>
    a.seat !== b.seat ? (a.seat === "accountant" ? -1 : 1) : a.name.localeCompare(b.name);
  missing.sort(order);
  withdrawn.sort(order);
  return { missing, withdrawn, expected, asOf: at.toISOString() };
}
