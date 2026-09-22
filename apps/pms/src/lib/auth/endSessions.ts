import type { AuthStore } from "./store";

/**
 * End one person's sessions (Increment 1.88).
 *
 * The `new_device_financial_role` hard event tells the owner that somebody
 * holding a critical duty signed in from a browser nobody has seen on that
 * account before. Until now the product offered nothing to do about it: the
 * alarm rendered on the owner's board, its link pointed at Practice Risk — a
 * screen that carries neither the alarm nor any control for it — and the only
 * session-ending route in the product (`api/admin/revoke-all-sessions`) ends
 * every session in the practice, which no screen called and which is a far
 * blunter act than the alarm describes.
 *
 * This is the proportionate one: the sessions of the person the alarm names,
 * and nobody else's.
 */

export type EndSessionsResult =
  | { ok: true; revoked: number; displayName: string }
  | { ok: false; status: number; code: string; why: string };

/**
 * `store.revokeSessionsForUser` resolves the target's own tenant and scopes
 * its transaction to that, so it will end a session in **any** practice if
 * handed an id from one. The tenant check therefore belongs here, before the
 * call, and not in the store.
 *
 * A target in another practice answers exactly as one that does not exist.
 * Saying "that person is not in this practice" would confirm the account to
 * somebody who only guessed at it, and the caller can act on neither answer.
 */
export async function endSessionsForPerson(
  store: AuthStore,
  input: { tenantId: string; actor: { id: string; name: string }; targetUserId: string; at: Date }
): Promise<EndSessionsResult> {
  if (input.targetUserId === input.actor.id) {
    return {
      ok: false,
      status: 409,
      code: "self",
      why:
        "This ends somebody else's sessions. To end your own, sign out — the button in the header does it, " +
        "and it does not need an administrator.",
    };
  }

  const target = await store.getUserById(input.targetUserId);
  if (!target || target.tenantId !== input.tenantId) {
    return {
      ok: false,
      status: 404,
      code: "not_in_practice",
      why: "No such person in this practice.",
    };
  }

  const revoked = await store.revokeSessionsForUser(input.targetUserId, input.at);
  await store.appendDomainEvent({
    tenantId: input.tenantId,
    actorUserId: input.actor.id,
    kind: "auth.sessions_ended",
    payload: {
      targetUserId: input.targetUserId,
      targetUsername: target.username,
      revoked,
      by: input.actor.name,
    },
    at: input.at,
  });
  return { ok: true, revoked, displayName: target.displayName };
}

/**
 * What the owner is told afterwards. A count of zero is worth saying plainly
 * rather than reporting as a failure: the person may have signed out already,
 * or the session may have timed out between the alarm and the press, and in
 * both cases the thing the owner wanted is true.
 */
export function endedSentence(displayName: string, revoked: number): string {
  if (revoked === 0) {
    return `${displayName} had no sessions left to end. Nothing was signed in, so nothing changed.`;
  }
  const word = revoked === 1 ? "sign-in" : "sign-ins";
  return `Ended ${revoked} ${word} for ${displayName}. The next request from any of them is refused, and signing in again needs the password and a code.`;
}
