import type { AuthStore } from "./store";

export interface RevokeAllSessionsResult {
  revoked: number;
}

/**
 * Why every sign-in in the practice ended (Increment 1.90).
 *
 * The route hardcoded `reason: "admin_revoke_all"`, which records that the act
 * happened and nothing about why — and this is the act a practice reaches for
 * during an incident, which is exactly when the reason is the part worth
 * keeping. It is now typed by the person pressing, and the length floor is the
 * same one a hard-event acknowledgement uses: enough to be a sentence rather
 * than a keystroke.
 */
export function revokeReasonProblem(raw: string): string | null {
  const reason = raw.trim();
  if (reason.length < 10) {
    return "Say in at least ten characters why every sign-in is ending. It goes on the chain beside the act, and it is what the practice reads afterwards.";
  }
  if (reason.length > 200) {
    return "Keep the reason under two hundred characters. The detail belongs wherever this practice keeps its incident notes.";
  }
  return null;
}

/**
 * What the administrator is told afterwards.
 *
 * Their own sign-in is one of the ones that ended, so the sentence says so:
 * the next thing this screen does is meet a session that no longer exists, and
 * somebody who was not told to expect that reads it as a fault.
 */
export function everybodySignedOutSentence(revoked: number): string {
  if (revoked === 0) {
    return "Nobody was signed in, so nothing changed. The practice was already closed to every live session.";
  }
  const word = revoked === 1 ? "sign-in" : "sign-ins";
  return `Ended ${revoked} ${word} across the practice — including your own. Everybody signs in again with their password and a code from their authenticator.`;
}

/**
 * Incident-response helper: end every live session in the tenant and record
 * the action, and the reason for it, in the append-only event stream.
 */
export async function revokeAllSessionsForTenant(
  store: AuthStore,
  input: { tenantId: string; actorUserId: string; reason: string; at: Date }
): Promise<RevokeAllSessionsResult> {
  const revoked = await store.revokeSessionsForTenant(input.tenantId, input.at);
  await store.appendDomainEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    kind: "auth.sessions_revoked_all",
    payload: { reason: input.reason, revoked },
    at: input.at,
  });
  return { revoked };
}

/**
 * Reading the act back (Increment 1.102).
 *
 * `revokeReasonProblem` refuses under ten characters and tells the person
 * pressing that what they type "is what the practice reads afterwards". That
 * was not true when it was written: the reason reached the chain and no
 * screen, digest or package ever read it. These are the words the screen
 * reads it back with, and they live beside the words that demanded it so the
 * two cannot drift apart.
 *
 * The shape is deliberately the caller's, not `RevokeAllRecord`'s: this
 * module is imported by a client component, and the module that reads the
 * rows imports drizzle and the database client, which a client component
 * cannot carry.
 */
export function signOutActSentence(act: { byName: string | null; revoked: number }): string {
  /**
   * A seat can leave the practice after taking this act, and the act does not
   * leave with it. The row is still worth reading, so it says plainly that it
   * cannot name anybody rather than naming nobody.
   */
  const who = act.byName ?? "An administrator whose seat has since gone";
  if (act.revoked === 0) {
    return `${who} ended every sign-in, and nobody was signed in.`;
  }
  const word = act.revoked === 1 ? "sign-in" : "sign-ins";
  return `${who} ended ${act.revoked} ${word}.`;
}

/**
 * What a row shows where the reason would be.
 *
 * An empty reason is not somebody typing nothing — the guard has refused that
 * since Increment 1.90. It is a row this practice recorded before the reason
 * was asked for, when the route hardcoded `admin_revoke_all`. It says so.
 */
export function signOutReasonSentence(reason: string): string {
  return reason.trim() === "" ? "Recorded before this screen asked why." : reason;
}

/** What the screen says when the practice has never ended every sign-in at once. */
export function noSignOutActsSentence(): string {
  return "This practice has never ended every sign-in at once. When it does, what the administrator types below is read back here.";
}
