/**
 * The shape of an invitation link, and nothing that touches a row
 * (Increment 1.71).
 *
 * Pure and separate for the two reasons this codebase always separates such a
 * module: the invitation's own screen is a client component, and a client
 * component that reached a module which reaches the database drags `pg` into
 * the browser bundle — which `tsc` says nothing about and `next build` refuses
 * outright.
 *
 * **The link carries the practice's id as well as the secret**, exactly as a
 * stop link does (Increment 1.67) and for exactly the same reason: the
 * database refuses cross-practice reads, and a browser arriving with no
 * session has nothing to say which practice to ask. The id is not the
 * authorisation. A wrong id with a right secret finds nothing, a right id with
 * a wrong secret finds nothing, and both are answered in the same words.
 */

/** A uuid, then a dot, then the secret. Neither half can contain the separator. */
const REF_SHAPE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export type InviteRef = { tenantId: string; secret: string };

export function packInviteRef(ref: InviteRef): string {
  return `${ref.tenantId}.${ref.secret}`;
}

/**
 * Reads a reference a browser supplied, or null where it is not one this
 * product could have issued.
 *
 * Checked before anything is looked up, because the practice id goes on to be
 * set as the transaction's own and a value of the wrong shape would fail as a
 * cast rather than as an answer — reaching the reader as a broken page instead
 * of a sentence.
 */
export function parseInviteRef(raw: string): InviteRef | null {
  const match = REF_SHAPE.exec(raw.trim());
  return match ? { tenantId: match[1]!, secret: match[2]! } : null;
}

export function inviteUrl(appUrl: string, ref: InviteRef): string {
  return `${appUrl.replace(/\/+$/, "")}/invite/${packInviteRef(ref)}`;
}

/**
 * How long an invitation works.
 *
 * Seven days, and far shorter than a stop link's thirty, because the two
 * secrets point in opposite directions. A stop link can only withhold, so the
 * worst a leaked one achieves is that a practice stops mailing a mailbox. This
 * one **opens an account**: it is the only token in this product whose leak
 * hands somebody a seat rather than taking one away, and the window is sized
 * by that rather than by what is convenient.
 *
 * Stored rather than derived, unlike the stop link's. A stop link's life is
 * arithmetic on the message that carried it, because that message is a row
 * nothing changes; an invitation has no such row behind it, and a window read
 * from a constant would silently move every invitation ever issued the day the
 * constant changed.
 */
export const INVITE_LIFE_DAYS = 7;
export const INVITE_LIFE_MS = INVITE_LIFE_DAYS * 24 * 60 * 60 * 1000;

export function inviteWorksUntil(invitedAt: string | Date): Date {
  const from = typeof invitedAt === "string" ? new Date(invitedAt) : invitedAt;
  return new Date(from.getTime() + INVITE_LIFE_MS);
}

/**
 * What a practice may name a seat, checked here so the screen can say it.
 *
 * Deliberately narrow: a username is typed at a sign-in box by somebody who
 * was told it over the phone, and the unique index it lands in is
 * `(tenant_id, username)` with no folding of its own. Allowing case or spaces
 * would make "the same username" a question with two answers.
 */
const USERNAME_SHAPE = /^[a-z0-9][a-z0-9-]{2,39}$/;

export function usernameProblem(raw: string): string | null {
  if (!USERNAME_SHAPE.test(raw)) {
    return "A username is 3 to 40 characters of lower-case letters, digits and hyphens, starting with a letter or digit.";
  }
  return null;
}
