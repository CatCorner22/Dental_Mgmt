/**
 * The shape of a recovery link, and nothing that touches a row
 * (Increment 1.77).
 *
 * Pure and separate for the reason `inviteLink.ts` gives: the page that reads
 * one is a client component, and a client component reaching a module that
 * reaches the database drags `pg` into the browser bundle — which `tsc` says
 * nothing about and `next build` refuses outright.
 *
 * **The reference is the reset token itself**, minted by
 * `approveRecoveryCeremony` as `<ceremony id>.<32 random bytes>`. It carries no
 * practice id, and needs none: the ceremony is found by
 * `auth_lookup_recovery_ceremony`, which reads across practices by design so
 * that a browser with no session can be answered at all. The id half is not the
 * authorisation — the row keeps only a SHA-256 of the whole token, so a right
 * id with a wrong secret finds nothing, and both are answered in the same
 * words.
 *
 * The token is never stored by this product in a form it could repeat. An
 * approver who loses the link starts the ceremony again, exactly as a practice
 * that mislaid an invitation invites again (Increment 1.73).
 */

/** A uuid, then a dot, then 32 random bytes in base64url. */
const REF_SHAPE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

/**
 * Reads a reference a browser supplied, or null where it is not one this
 * product could have issued. Checked before anything is looked up, so a value
 * of the wrong shape reaches the reader as a sentence rather than as a failed
 * uuid cast.
 */
export function parseRegainRef(raw: string): string | null {
  return REF_SHAPE.test(raw.trim()) ? raw.trim() : null;
}

export function regainUrl(appUrl: string, resetToken: string): string {
  return `${appUrl.replace(/\/+$/, "")}/regain/${resetToken}`;
}
