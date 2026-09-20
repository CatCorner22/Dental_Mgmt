import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  noticeAddressChallenges,
  noticeAddressRefusals,
  noticeAddresses,
  tenants,
  uuidv7,
} from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { stopLinkWorksUntil } from "./stopLink";

/**
 * Stopping a code nobody asked for (Increment 1.67).
 *
 * Increment 1.61 built the proof because a signed-in person can point this
 * product's mail at an address that is not theirs; Increment 1.63 limited how
 * often they may do it, and explained why the limit belongs on asking rather
 * than on guessing. Neither gave the person on the other end anything to do.
 * The message told them to ignore it, which is advice that works for the
 * product and not for the reader: five codes an hour, week after week, is
 * still five codes an hour arriving somewhere nobody asked.
 *
 * So the reader gets the one thing this product had never offered anybody
 * outside a practice: a way to say no.
 *
 * **A second token, with the opposite power.** Increment 1.61 refused to put
 * the code in a link, because a link is a state-changing GET that leaves a
 * bearer secret in a URL a browser keeps, a proxy logs and a referrer leaks —
 * and that secret *proves* an address. This secret cannot prove anything. All
 * it can do is withhold, and withholding is the safe direction: the worst a
 * leaked stop link achieves is that a practice stops mailing one mailbox and
 * says so on the screen of the person whose mailbox it was. The argument
 * against a link was never about links; it was about what the thing in the
 * link could do.
 *
 * **The GET shows, the POST acts.** Mail clients and scanners fetch links
 * before a person reads them, so a link that refused on being fetched would
 * hand every anti-malware appliance in the world a button it presses on its
 * owner's behalf. The page reads; a form on it acts.
 *
 * **The page names no mailbox.** It names the practice, and says "the mailbox
 * where you found this", because a reader holding the message already knows
 * which mailbox and a reader holding only a leaked URL should not learn one.
 *
 * **No undoing.** The only evidence that could authorise lifting a refusal is
 * a code sent to that mailbox, and a refused mailbox is one this practice may
 * no longer send a code to. The deadlock is deliberate: an undo authorised by
 * the practice would be an undo authorised by exactly the party the refusal
 * protects against. What the practice keeps is the other mailbox — a person
 * whose address was refused sets a different one, and the product loses a
 * destination rather than a person.
 */

/**
 * 32 bytes from the system's own randomness, base64url, 43 characters.
 *
 * Not the ten-character alphabet the code uses. That alphabet exists so a
 * person can read it off one screen and type it into another, and its
 * shortness is paid for by the code living a day inside one practice's own
 * rows. This one is never typed, never shown, and answers to a route that no
 * session stands behind, so it is sized for the only thing that matters about
 * it: that nobody reaches it by trying.
 */
export function mintStop(): string {
  return randomBytes(32).toString("base64url");
}

export function hashStop(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export type StopRefusal = {
  ok: false;
  status: 404 | 409;
  code: "unknown" | "expired" | "already_stopped";
  why: string;
};

export type StopTarget = {
  challengeId: string;
  practiceName: string;
  /** The mailbox the message reached. Held for the row that gets written, and never rendered. */
  address: string;
  issuedAt: string;
  worksUntil: string;
};

export type StopLookup = { ok: true; target: StopTarget } | StopRefusal;

/**
 * Whether somebody reading this mailbox has already refused this practice's
 * messages, or null where nobody has.
 *
 * The fold is `lower()`, evaluated by Postgres, because the same expression
 * decides it in the trigger that refuses a new address row. Folding a second
 * time in this language would be a second answer waiting to disagree with the
 * first, and the disagreement would surface as a database error where the
 * screen had promised a sentence.
 */
export async function addressRefusal(
  db: AppDb,
  tenantId: string,
  address: string
): Promise<{ refusedAt: string } | null> {
  const rows = await db
    .select({ refusedAt: noticeAddressRefusals.refusedAt })
    .from(noticeAddressRefusals)
    .where(
      and(
        eq(noticeAddressRefusals.tenantId, tenantId),
        sql`lower(btrim(${noticeAddressRefusals.address})) = lower(btrim(${address}))`
      )
    )
    .limit(1);
  const row = rows[0];
  return row ? { refusedAt: row.refusedAt.toISOString() } : null;
}

/**
 * What a stop link points at, or why it points at nothing.
 *
 * A secret that names no row and a secret belonging to another practice are
 * answered in the same words, because they are the same fact from the reader's
 * side and telling them apart would turn the page into an oracle for which
 * practice a given secret belongs to.
 *
 * 404 rather than the 409 Increment 1.61 chose for an unknown code. That
 * choice turned on the prove route addressing no resource by name, so nothing
 * there could be missing. This link names one, and a link naming something
 * that is not here is the plain meaning of 404.
 */
export async function lookUpStop(
  db: AppDb,
  tenantId: string,
  secret: string,
  at: Date = new Date()
): Promise<StopLookup> {
  const rows = await db
    .select({
      challengeId: noticeAddressChallenges.id,
      issuedAt: noticeAddressChallenges.issuedAt,
      address: noticeAddresses.address,
    })
    .from(noticeAddressChallenges)
    .innerJoin(noticeAddresses, eq(noticeAddresses.id, noticeAddressChallenges.addressId))
    .where(
      and(
        eq(noticeAddressChallenges.tenantId, tenantId),
        eq(noticeAddressChallenges.stopHash, hashStop(secret))
      )
    )
    .orderBy(desc(noticeAddressChallenges.issuedAt))
    .limit(1);
  const row = rows[0];
  if (!row || row.address === null) {
    return {
      ok: false,
      status: 404,
      code: "unknown",
      why: "This link is not one we recognise. It may have been copied incompletely, or it may never have been ours.",
    };
  }

  const worksUntil = stopLinkWorksUntil(row.issuedAt);
  if (at >= worksUntil) {
    return {
      ok: false,
      status: 409,
      code: "expired",
      why: `This link stopped working on ${worksUntil.toISOString().slice(0, 10)}. If messages are still arriving, the newest one carries a link that works.`,
    };
  }

  const practiceName =
    (await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1))[0]?.name ??
    "This practice";

  const already = await addressRefusal(db, tenantId, row.address);
  if (already !== null) {
    return {
      ok: false,
      status: 409,
      code: "already_stopped",
      why: `${practiceName} was already told on ${already.refusedAt.slice(0, 10)} that this mailbox did not ask for its messages, and it has sent none since.`,
    };
  }

  return {
    ok: true,
    target: {
      challengeId: row.challengeId,
      practiceName,
      address: row.address,
      issuedAt: row.issuedAt.toISOString(),
      worksUntil: worksUntil.toISOString(),
    },
  };
}

export type StopResult = { ok: true; practiceName: string; refusedAt: string } | StopRefusal;

/**
 * Records that somebody reading this mailbox did not ask for these messages.
 *
 * Looks the link up again rather than trusting what the page was rendered
 * with: the page may have sat open while the link expired or while somebody
 * else pressed the same button, and a write authorised by a read that old is
 * a write authorised by nothing.
 *
 * The chain event names no mailbox and no person, which is the rule every
 * address event here has held since Increment 1.58 — and it is easier to hold
 * than usual, because there is no person to name. It carries the challenge
 * instead, which points at the message that provoked this without saying where
 * that message went.
 */
export async function refuseAddress(
  db: AppDb,
  tenantId: string,
  secret: string,
  at: Date = new Date()
): Promise<StopResult> {
  const found = await lookUpStop(db, tenantId, secret, at);
  if (!found.ok) return found;

  await db.insert(noticeAddressRefusals).values({
    id: uuidv7(),
    tenantId,
    challengeId: found.target.challengeId,
    address: found.target.address,
    refusedAt: at,
  });
  await appendControlEvent(db, tenantId, null, "notice.address_refused", { challenge: found.target.challengeId }, at);

  return { ok: true, practiceName: found.target.practiceName, refusedAt: at.toISOString() };
}
