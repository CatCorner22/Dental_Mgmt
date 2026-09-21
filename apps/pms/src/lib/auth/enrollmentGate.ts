/**
 * The two decisions the enrolment gate makes, held in one place (Increment
 * 1.80): which paths an account that still owes a second factor may reach, and
 * what the enrolment screen does with the answer its route gave it.
 *
 * Both used to live where nothing could test them — the first inside
 * `middleware.ts`, which runs on the edge under NextAuth's wrapper, and the
 * second inside a client component, of which this app has none under test. So
 * neither was ever exercised, and between them they held a person on a screen
 * with nothing to click.
 *
 * ## What went wrong
 *
 * Finishing an enrolment revokes every session for that account
 * (`api/enroll-mfa/route.ts`), which is right: each of those sessions was
 * minted before the account had a factor, so not one of them passed the factor
 * it now has. What the product did not do was end the browser's half of the
 * same session. The signed cookie survived, and the claim it carries —
 * `needsMfaEnrollment` — is written by the `jwt` callback only when NextAuth
 * hands it a `user`, which happens at sign-in and never again. So the cookie
 * went on saying "this account still owes a second factor" after the factor
 * existed.
 *
 * The middleware believed it, as it must: on the edge there is no database to
 * ask. Every path but the enrolment screen redirected back to the enrolment
 * screen, `/signin` included. The screen then asked its own route for a setup
 * URI, and the route refused with 401 — the session behind the cookie was the
 * one the enrolment had just revoked. The form had no reading for a refusal
 * other than a message and a disabled button: no setup URI meant `Finish
 * enrollment` stayed disabled, `repairing` stayed false so the `Leave this as
 * it is` link never rendered, and the sign-out button lived inside the
 * recovery-codes branch, which is React state a reload throws away.
 *
 * A person who closed the tab on the codes screen, or reloaded it, or came
 * back the next morning, met one error line, one disabled button, and an
 * address bar that refused to go anywhere else.
 *
 * ## The rule this file holds
 *
 * A gate may hold somebody out of the application. It may not hold them away
 * from the door. `/signin` is admitted for that reason and no other: a person
 * there holds nothing — every guarded route still refuses an unenrolled
 * account through `requireAccess` — and abandoning a half-finished sign-in is
 * something a person must always be able to do.
 */

/**
 * Whether an account that still owes a second factor may reach `path`.
 *
 * `/api/auth` carries NextAuth's own endpoints, which is what lets the screen
 * end a session at all; `/api/enroll-mfa` is the route the screen reads and
 * writes; `/enroll-mfa` is the screen. `/signin` is the door.
 */
export function enrollmentGateAllows(path: string): boolean {
  return (
    path === "/enroll-mfa" ||
    path === "/signin" ||
    path.startsWith("/api/enroll-mfa") ||
    path.startsWith("/api/auth")
  );
}

/**
 * What a person is told when the session behind this screen is gone.
 *
 * True of both ways it goes: a session the enrolment itself revoked, and one
 * that simply ran out while the screen sat open. The second sentence is
 * conditional because only one of those two is somebody's own doing.
 */
export const SESSION_ENDED =
  "This sign-in has ended. Sign in again with your password and a code from your authenticator app. " +
  "If you have just paired one, that pairing is what ended it — the next sign-in is the first that uses it.";

/** What the screen reads off the route that starts an enrolment. */
export type EnrollmentStart =
  | { state: "ready"; otpauthUri: string; repairing: boolean }
  | { state: "ended"; why: string }
  | { state: "failed"; why: string };

/** What the screen reads off the route that finishes one. */
export type EnrollmentFinish =
  | { state: "done"; recoveryCodes: string[]; repaired: boolean; endSession: boolean }
  | { state: "ended"; why: string }
  | { state: "failed"; why: string };

function why(body: unknown, fallback: string): string {
  const said = (body as { error?: unknown } | null)?.error;
  return typeof said === "string" && said.trim() ? said : fallback;
}

/**
 * 401 is its own reading, and that is the whole of this function's reason to
 * exist. Every other failure leaves the person on a screen they can still use
 * — the code was wrong, the store is not configured, the network dropped — and
 * the form keeps its message beside the field. A 401 means the session this
 * screen was reached on no longer exists, so nothing on the screen can work
 * and the only honest thing to offer is the way back to the sign-in page.
 */
export function readEnrollmentStart(status: number, body: unknown): EnrollmentStart {
  if (status === 401) return { state: "ended", why: SESSION_ENDED };
  if (status < 200 || status >= 300) {
    return { state: "failed", why: why(body, "Could not start enrollment.") };
  }
  const data = (body ?? {}) as { otpauthUri?: unknown; repairing?: unknown };
  const otpauthUri = typeof data.otpauthUri === "string" ? data.otpauthUri : "";
  if (!otpauthUri) return { state: "failed", why: "Could not start enrollment." };
  return { state: "ready", otpauthUri, repairing: data.repairing === true };
}

/**
 * `endSession` is the route's own `signOut` field, which has been in the
 * response since Increment 1.72 and which nothing read. Reading it is what
 * closes the gap: the route revokes the session row, and the screen ends the
 * browser's half of the same session in the same breath, so the cookie cannot
 * outlive the row it names. The field is read strictly rather than defaulted,
 * because the route is the one place that decides whether the session ends.
 */
export function readEnrollmentFinish(status: number, body: unknown): EnrollmentFinish {
  if (status === 401) return { state: "ended", why: SESSION_ENDED };
  if (status < 200 || status >= 300) {
    return { state: "failed", why: why(body, "Could not verify the code.") };
  }
  const data = (body ?? {}) as {
    recoveryCodes?: unknown;
    repaired?: unknown;
    signOut?: unknown;
  };
  const recoveryCodes = Array.isArray(data.recoveryCodes)
    ? data.recoveryCodes.filter((c): c is string => typeof c === "string")
    : [];
  return {
    state: "done",
    recoveryCodes,
    repaired: data.repaired === true,
    endSession: data.signOut === true,
  };
}
