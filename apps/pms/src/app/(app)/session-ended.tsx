"use client";

import { usePathname } from "next/navigation";
import { isSignInEnded } from "@/lib/auth/guardedFetch";
import { Refusal } from "./refusal";
import {
  SESSION_ENDED_STEP,
  SESSION_ENDED_VERB,
  SESSION_ENDED_WHY,
  signInHref,
} from "@/lib/auth/viewer";

/**
 * One shape for a sign-in that is over, on every screen (Increment 1.81).
 *
 * It is a Refusal because that is what docs/04 asks a refusal to be — what was
 * refused, why, and what to do next, with no accusation and no dead end — and
 * because a screen that refuses to load without saying which of those three it
 * means is the dead end that shape exists to prevent.
 *
 * The link carries the screen the reader was on, so signing in again returns
 * them to it rather than to the practice home. `signInHref` runs the path
 * through the same guard the sign-in page applies to the parameter it receives.
 */
export function SessionEnded() {
  const path = usePathname();
  return (
    <Refusal
      refusal={{
        verb: SESSION_ENDED_VERB,
        why: SESSION_ENDED_WHY,
        nextSteps: [SESSION_ENDED_STEP],
      }}
    >
      <a
        id="session-ended-signin"
        className="inline-flex min-h-[var(--target)] items-center rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white"
        href={signInHref(path)}
      >
        Sign in
      </a>
    </Refusal>
  );
}

/**
 * What a screen's load state becomes when the load threw (Increment 1.82).
 *
 * Every screen held this decision as the same four lines, and every one of
 * them made it wrongly: a sign-in that had ended arrived as an ordinary
 * `Error` carrying `requireAccess`'s own sentence, and went on screen as a
 * paragraph with nothing to press. The fallback is still the caller's, because
 * only the screen knows what it was trying to read.
 */
export function loadFailure(
  err: unknown,
  fallback: string
): { status: "sign_in_ended" } | { status: "error"; message: string } {
  if (isSignInEnded(err)) return { status: "sign_in_ended" };
  return { status: "error", message: err instanceof Error ? err.message : fallback };
}
