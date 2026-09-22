/**
 * One way to read a guarded answer, on every screen (Increment 1.82).
 *
 * Increment 1.81 drew the line between a sign-in that has ended and a seat
 * that lacks rank, and taught the seven screens that pre-read `/api/me` to
 * respect it. Nine more never read a viewer at all — the ledger and an
 * account's explanation, posting a payment, the approvals inbox, the day
 * close, bank reconciliation and a run, statements and a statement. Each one
 * loads straight from a guarded route with the same line:
 *
 *     if (!res.ok) throw new Error(body.error ?? "Could not load ...");
 *
 * A person whose sign-in ended on any of them therefore met the route's own
 * sentence — "This session timed out. Sign in again." — as a bare paragraph,
 * under a header `navLinksFor(null)` had emptied. True, and a dead end: no
 * link, no control, and nothing naming the one act that would fix it.
 *
 * So the reading moves out of the screens. `getGuarded` is the only way these
 * screens fetch, it raises `SignInEnded` on a 401 and an ordinary `Error` on
 * anything else, and each screen's `catch` turns the first into the panel
 * Increment 1.81 built and leaves the second exactly where it was.
 *
 * The shape is not new. Practice Risk has had it since Increment 1.81, where
 * it was written for one screen because that screen reads ten routes at once
 * and needed the classification to survive a race. It was the only correct
 * version in the product, and it lived where nothing else could reach it.
 */

/**
 * The sign-in behind this screen is over: revoked, expired, idle, or never
 * made. `requireAccess` answers 401 for all four and for nothing else.
 *
 * Named for what the reader is told rather than for the status, because the
 * status is an implementation detail of the answer and the sentence is not.
 */
export class SignInEnded extends Error {
  constructor() {
    super("The sign-in behind this screen has ended.");
    this.name = "SignInEnded";
  }
}

/** Whether an error thrown out of a load is a sign-in that ended. */
export function isSignInEnded(err: unknown): boolean {
  return err instanceof SignInEnded;
}

/**
 * Reads a guarded route.
 *
 * A 401 raises `SignInEnded`, classified on the status rather than on the
 * sentence: matching words would tie every screen to four strings that belong
 * to `requireAccess`, and would quietly stop working the day one of them is
 * reworded. Every other failure raises an ordinary `Error` carrying the
 * route's own words, which is what the screens already show and what a person
 * on a screen that still works should read.
 */
export async function getGuarded<T>(url: string, fallback?: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401) throw new SignInEnded();
  if (!res.ok) throw new Error(body.error ?? fallback ?? `Could not load ${url}.`);
  return body;
}

/**
 * The same reading for a fetch a screen makes its own way — a POST, or a GET
 * carrying headers this helper does not take.
 *
 * It raises rather than returning a value so that a caller's existing
 * `if (!res.ok) throw` reads the same before and after: the 401 is lifted out
 * ahead of it, and everything else falls through untouched.
 */
export function refuseIfSignInEnded(res: { status: number }): void {
  if (res.status === 401) throw new SignInEnded();
}
