import { and, desc, eq } from "drizzle-orm";
import { noticeAddresses, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";

/**
 * Where a person's notices would go, and who may say so (Increment 1.58).
 *
 * The product has never held an address. Every surface it has is a screen
 * behind a guard, so `users` carries a username and a display name and nothing
 * that points outside. An address is the first thing here whose whole purpose
 * is to leave, and that is what shapes both the table and this module.
 *
 * **A person sets their own address and nobody else's.** The database holds
 * that rule against `app.user_id` rather than trusting this file, because an
 * administrator who could write another person's address could redirect that
 * person's notices — silently, and the notices are exactly the signal that
 * something has gone unattended. This is stricter than the rest of the
 * product, where one person acts for the practice all the time; it is stricter
 * because this is the one act whose entire risk is being done on somebody
 * else's behalf.
 *
 * **Withdrawing is an act.** A person who stops wanting messages has decided
 * something, and the record of having stopped is worth what the record of
 * having started is worth. So a withdrawal writes a row carrying no address
 * rather than removing the row that carried one.
 */

/** Anything with an `@`, a dot after it, and no spaces. Deliberately loose: the strict test is whether a message arrives, which Increment 1.58 does not attempt. */
const ADDRESS_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NoticeAddress = {
  /** The row's own id. A proof points at this rather than at the person, so changing an address unproves it (Increment 1.61). */
  id: string;
  userId: string;
  /** Null when the person has withdrawn, which is a decision rather than an absence. */
  address: string | null;
  /** ISO timestamp of the act in force. */
  setAt: string;
};

export type AddressRefusal = {
  ok: false;
  status: 400 | 409;
  code: "malformed" | "unchanged";
  verb: string;
  why: string;
};

export type AddressResult = { ok: true; address: NoticeAddress } | AddressRefusal;

/**
 * The address in force for one person, or null where they have never set one.
 *
 * Newest row wins, which is the whole read: the table is append-only, so a
 * person accumulates rows over time and only the last one says where a message
 * would go today.
 */
export async function currentAddress(db: AppDb, tenantId: string, userId: string): Promise<NoticeAddress | null> {
  const rows = await db
    .select()
    .from(noticeAddresses)
    .where(and(eq(noticeAddresses.tenantId, tenantId), eq(noticeAddresses.userId, userId)))
    .orderBy(desc(noticeAddresses.setAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, userId: row.userId, address: row.address, setAt: row.setAt.toISOString() };
}

/**
 * Records where this person's notices would go, or that they would go nowhere.
 *
 * Refuses, in words:
 * - an address that could not receive anything, because a message sent to one
 *   fails silently and a signal nobody gets is worse than no signal at all;
 * - an address identical to the one already in force, because a row that
 *   changes nothing still claims somebody decided something that day.
 *
 * The caller is the person: `withTenantTransaction` sets `app.user_id`, and the
 * database refuses the insert outright if it names anybody else. This function
 * passes `userId` rather than accepting one, so no route can supply a target.
 */
export async function setAddress(
  db: AppDb,
  tenantId: string,
  userId: string,
  userName: string,
  address: string | null,
  at: Date = new Date()
): Promise<AddressResult> {
  const trimmed = address === null ? null : address.trim();
  if (trimmed !== null && !ADDRESS_SHAPE.test(trimmed)) {
    return {
      ok: false,
      status: 400,
      code: "malformed",
      verb: "set this address",
      why: `"${trimmed}" is not an address a message could reach. Use the form name@example.com, or clear it to stop receiving messages.`,
    };
  }

  const held = await currentAddress(db, tenantId, userId);
  if (held !== null && held.address === trimmed) {
    return {
      ok: false,
      status: 409,
      code: "unchanged",
      verb: trimmed === null ? "withdraw" : "set this address",
      why:
        trimmed === null
          ? `You already receive no messages, recorded on ${held.setAt.slice(0, 10)}.`
          : `${trimmed} is already the address on file, recorded on ${held.setAt.slice(0, 10)}.`,
    };
  }

  const id = uuidv7();
  await db.insert(noticeAddresses).values({ id, tenantId, userId, address: trimmed, setAt: at });
  // The event names the act and never the address: the chain is read by people
  // who may govern this practice without being this person, and where somebody
  // is reachable is theirs.
  await appendControlEvent(
    db,
    tenantId,
    userId,
    trimmed === null ? "notice.address_withdrawn" : "notice.address_set",
    { by: userName },
    at
  );
  return { ok: true, address: { id, userId, address: trimmed, setAt: at.toISOString() } };
}
