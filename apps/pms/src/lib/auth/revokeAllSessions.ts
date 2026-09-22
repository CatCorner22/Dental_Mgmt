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
