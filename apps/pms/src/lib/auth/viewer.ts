import { sanitizeCallbackPath } from "./loginFormState";

/**
 * Who the screen is talking to, read once from `/api/me` (Increment 1.81).
 *
 * ## What went wrong
 *
 * Seven screens asked `/api/me` before deciding what to show, and between them
 * gave five different answers to one question. Four — the owner board, the
 * Locations page, the weekly digest and the month-end package — tested
 * `!meRes.ok`, which is true of a 401 exactly as much as of a 403, and
 * concluded that the seat lacked the rank:
 *
 *     "The board is for the manager and owner seats. Your seat works from the
 *      links in the header."
 *
 * That sentence is false when the session merely ended. The reader may be the
 * owner, and the rank they hold has not moved. Worse, it sends them to a header
 * that `navLinksFor(null)` has emptied for the same reason — so the one remedy
 * it names is the one thing the screen has just taken away. Two false
 * statements, each propping up the other.
 *
 * Two more screens — Practice Risk and Reason codes — read the body without
 * looking at the status at all, found no role in it, and quietly rendered the
 * read-only view. A person who had been an administrator a minute earlier
 * watched their controls disappear with nothing said.
 *
 * This is not a rare state. `IDLE_MS` is thirty minutes at a desk and ten in an
 * operatory, so a lunch break or one long appointment reaches it, and an
 * administrator standing somebody down (Increment 1.79), a recovery ceremony
 * (Increment 1.77) and a re-pairing (Increment 1.76) all revoke sessions
 * outright.
 *
 * ## The rule
 *
 * **A session that has ended is never reported as a seat that lacks rank.**
 * They are different facts about different things: one is about the sign-in,
 * which the person can fix in ten seconds, and the other is about the seat,
 * which they cannot fix at all. Telling somebody the second when the first is
 * true sends them to their practice manager over a session timeout.
 *
 * `home/session-status.tsx` already held the right answer — "Not signed in",
 * with the only sign-in link in the product — on one screen, as one line. This
 * makes that the shape every screen uses.
 */

/** The three things `/api/me` can tell a screen. */
export type Viewer =
  | {
      state: "present";
      username: string;
      displayName: string;
      role: string;
      entitlements: string[];
    }
  /** The sign-in is over: revoked, timed out, expired, or never made. */
  | { state: "ended"; why: string }
  /** Something else went wrong, and the seat is unknown rather than absent. */
  | { state: "unknown"; why: string };

/**
 * What the reader is told when the sign-in is over.
 *
 * One sentence for all four ways it happens, because a person cannot act on the
 * difference between a session revoked and a session timed out: both want the
 * same next step, and naming which one would be telling them about the
 * product's bookkeeping rather than about their morning.
 */
export const SESSION_ENDED_VERB = "Your sign-in has ended.";

export const SESSION_ENDED_WHY =
  "This can happen after a spell away from the screen, or when somebody changed this account. " +
  "Nothing you were doing was lost, and your seat has not changed.";

export const SESSION_ENDED_STEP = "Sign in again to carry on from the same screen.";

/**
 * Reads one `/api/me` answer.
 *
 * 401 is the only status that means the sign-in is over — `requireAccess`
 * answers it for a revoked session, an expired one, an idle one and no session
 * at all, and 403 for every question about rank or grant. That line is what the
 * four screens above crossed.
 */
export function readViewer(status: number, body: unknown): Viewer {
  if (status === 401) return { state: "ended", why: SESSION_ENDED_WHY };
  const data = (body ?? {}) as {
    ok?: unknown;
    username?: unknown;
    displayName?: unknown;
    role?: unknown;
    entitlements?: unknown;
    error?: unknown;
  };
  if (status < 200 || status >= 300 || data.ok !== true) {
    const said = typeof data.error === "string" && data.error.trim() ? data.error : "";
    return { state: "unknown", why: said || "Could not read who is signed in." };
  }
  if (typeof data.role !== "string" || !data.role) {
    // A 200 that names no seat is not a seat without rank either. It is an
    // answer this screen cannot use, and saying so beats rendering the
    // read-only view as though the reader had been demoted.
    return { state: "unknown", why: "Could not read who is signed in." };
  }
  return {
    state: "present",
    username: typeof data.username === "string" ? data.username : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    role: data.role,
    entitlements: Array.isArray(data.entitlements)
      ? data.entitlements.filter((e): e is string => typeof e === "string")
      : [],
  };
}

/**
 * Where a person goes to sign in again, carrying the screen they were on.
 *
 * `sanitizeCallbackPath` is the same guard the sign-in page applies to the
 * parameter it receives, so a path this cannot vouch for lands on the practice
 * home rather than anywhere a caller chose.
 */
export function signInHref(path: string | null | undefined): string {
  return `/signin?callbackUrl=${encodeURIComponent(sanitizeCallbackPath(path))}`;
}
