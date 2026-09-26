/**
 * The shape of a stop link, and nothing that touches a row (Increment 1.67).
 *
 * Pure and separate for this codebase's usual two reasons: the message module
 * quotes it, and a client component that reached a module which reaches the
 * database drags `pg` into the browser bundle — which `tsc` says nothing about
 * and `next build` refuses outright.
 *
 * **The link carries the practice's id as well as the secret.** Every read in
 * this product runs inside a transaction that has already been told which
 * practice it is for, because the database refuses cross-practice reads and
 * that refusal is the isolation the whole schema rests on. A stranger's
 * browser arrives with no session and therefore with nothing to tell it, so
 * the link has to. The id is not the authorisation and is not treated as one:
 * it says which practice to ask, and the secret is what the answer depends on.
 * A wrong id with a right secret finds nothing, and a right id with a wrong
 * secret finds nothing, and both are answered in the same words.
 *
 * One path segment rather than two, because a reader should see one opaque
 * thing rather than a structure inviting them to edit half of it.
 */

/** A uuid, then a dot, then the secret. Neither half can contain the separator. */
const REF_SHAPE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export type StopRef = { tenantId: string; secret: string };

export function packStopRef(ref: StopRef): string {
  return `${ref.tenantId}.${ref.secret}`;
}

/**
 * Reads a reference a stranger's browser supplied, or null where it is not one
 * this product could have issued.
 *
 * Checked before anything is looked up, because the practice id goes on to be
 * set as the transaction's own, and a value of the wrong shape would fail as a
 * cast rather than as an answer — which reaches the reader as a broken page
 * instead of a sentence.
 */
export function parseStopRef(raw: string): StopRef | null {
  const match = REF_SHAPE.exec(raw.trim());
  return match ? { tenantId: match[1]!, secret: match[2]! } : null;
}

export function stopUrl(appUrl: string, ref: StopRef): string {
  return `${appUrl.replace(/\/+$/, "")}/notices/stop/${packStopRef(ref)}`;
}

/**
 * How long a stop link works, counted from the message that carried it.
 *
 * Longer than the code, because the two measure different things. A code stops
 * working after a day because a proof should rest on evidence somebody acted
 * on promptly; a refusal rests on the message having been unwanted, which does
 * not stop being true while the reader is away.
 *
 * Thirty days, and the number is bounded by what it protects rather than by
 * taste: a reader who is still being sent codes is still being handed fresh
 * links, so the only person this ever runs out on is one who was mailed once
 * and is no longer being bothered. What the limit buys is that a link in an
 * old proxy log is not a permanent lever.
 *
 * Derived from the challenge's own stamp, never stored. `notice_address_challenges`
 * already dates every ask and never changes one, so when a link stops working
 * is arithmetic on a row that cannot drift.
 */
export const STOP_LIFE_DAYS = 30;
export const STOP_LIFE_MS = STOP_LIFE_DAYS * 24 * 60 * 60 * 1000;

export function stopLinkWorksUntil(issuedAt: string | Date): Date {
  const from = typeof issuedAt === "string" ? new Date(issuedAt) : issuedAt;
  return new Date(from.getTime() + STOP_LIFE_MS);
}
