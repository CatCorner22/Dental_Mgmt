"use server";

import { PASSWORD_MIN } from "./password";
import { consumeRecoveryCeremony } from "./recoveryCeremony";
import type { RegainFormState } from "./regainFormState";
import { parseRegainRef } from "./regainLink";
import { getAuthStore } from "./resolveStore";

/**
 * The third act in this product that no session stands behind
 * (Increment 1.77), after the stop form (1.67) and the invitation (1.71).
 *
 * A server action rather than a route under `/api`, so that "every route under
 * `/api` passes through `withGuard`" is true of the whole surface. It was not
 * true before this increment: `api/recovery-ceremony/reset/route.ts` was the
 * one exception, guarded by `requestSurfaceOk` alone. It had no caller
 * anywhere in the app, this action replaces it, and it is deleted here rather
 * than left as a second way to do one thing.
 *
 * What authorises this is the reset token two administrators minted, and the
 * check for it is the lookup itself: the row keeps a SHA-256 of the whole
 * token, so nothing a caller supplies is trusted further than that hash.
 *
 * A mismatch between the two password fields is answered here rather than in
 * the browser, because a check that only the browser makes is a check a caller
 * may skip.
 */

export async function regainAction(_prev: RegainFormState, formData: FormData): Promise<RegainFormState> {
  const ref = parseRegainRef(String(formData.get("ref") ?? ""));
  if (ref === null) {
    return { settled: true, message: "This link is not one we recognise, so nothing about the account was changed." };
  }

  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) {
    return { settled: false, message: "The two passwords are not the same. Type the same one twice." };
  }
  if (password.length < PASSWORD_MIN) {
    return { settled: false, message: `A password is at least ${PASSWORD_MIN} characters.` };
  }

  const store = await getAuthStore();
  if (!store) {
    return { settled: false, message: "This product cannot reach its accounts right now. Try again shortly." };
  }

  const result = await consumeRecoveryCeremony(store, ref, password, new Date());
  if (!result.ok) {
    /**
     * One sentence for every refusal, as the stop page and the invitation page
     * both answer (Increments 1.67 and 1.71). A link that ran out, a link
     * nobody approved, a link already used and a link that was never ours are
     * told apart by anybody holding a real one and by nobody else, so telling
     * them apart aloud would only help somebody guessing.
     */
    return {
      settled: result.reason !== "invalid_password",
      message:
        result.reason === "invalid_password"
          ? `That password is not one this product accepts. At least ${PASSWORD_MIN} characters.`
          : "This link no longer works. It may have run out, it may have been used already, or the two administrators may not have finished approving it. Ask the practice to start again.",
    };
  }

  return {
    settled: true,
    message: `Your password is set. Sign in as ${result.username}; because your second factor was removed, you will be asked to pair an authenticator on the way in.`,
  };
}
