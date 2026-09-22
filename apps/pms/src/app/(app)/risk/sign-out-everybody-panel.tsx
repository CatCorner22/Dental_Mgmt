"use client";

import { useCallback, useState } from "react";

/**
 * Ending every sign-in in the practice (Increment 1.90).
 *
 * The route has existed since Increment 0.8 and no screen ever called it: an
 * incident-response act reachable only by somebody who could already write
 * HTTP by hand. Increment 1.88 gave the board the proportionate act — end one
 * named person's sessions — and left this one, deliberately, because it is a
 * different act with a different consequence.
 *
 * **It signs out the person pressing it.** That is not a side effect to be
 * discovered afterwards; it is the first thing this panel says, and it is why
 * the act asks for a typed reason rather than a bare confirmation. A reason
 * both slows the press and is the part the practice reads later — which during
 * an incident is the part that matters.
 *
 * The panel does not ask "are you sure". A sentence somebody has to compose is
 * a better guard than a dialogue they can dismiss, and it leaves something
 * behind.
 */
export function SignOutEverybodyPanel({ isAdmin }: { isAdmin: boolean }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reasonOk = reason.trim().length >= 10;

  const signOutEverybody = useCallback(async () => {
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/admin/revoke-all-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; sentence?: string };
      if (!res.ok) {
        setSaid(body.error ?? "Nothing was signed out.");
        return;
      }
      setSaid(body.sentence ?? "Every sign-in in the practice has ended.");
      setReason("");
      /**
       * Nothing reloads after this. The session that made the request is one
       * of the ones it ended, so every later read from this screen would meet
       * a sign-in that is over — and showing that as a failure would report
       * the act's success as a fault.
       */
      setDone(true);
    } catch {
      setSaid("Nothing was signed out.");
    } finally {
      setBusy(false);
    }
  }, [reason]);

  if (!isAdmin) return null;

  return (
    <section aria-labelledby="sign-out-everybody" className="mb-10">
      <h2 id="sign-out-everybody" className="mb-1 text-lg font-semibold">
        End every sign-in in the practice
      </h2>
      <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
        For the hour somebody thinks a password or a phone has gone astray and nobody yet knows whose. It ends every live
        sign-in at once, <strong>including your own</strong>. Nothing anybody did is undone and no account is closed:
        everybody signs in again with their password and a code from their authenticator.
      </p>
      <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:max-w-xl">
        {done ? (
          <p className="text-sm font-semibold text-[var(--ink)]" aria-live="polite">
            {said}{" "}
            {/*
             * Underlined always, not on hover (Increment 1.90). axe's
             * `link-in-text-block` caught this: a link inside a paragraph
             * distinguished by colour alone fails for anybody who cannot tell
             * this colour from the surrounding ink. The screen's other links
             * sit on their own line, where the rule does not apply; this one
             * does not.
             */}
            <a className="font-semibold text-[var(--link)] underline underline-offset-2" href="/signin">
              Sign in again
            </a>
            .
          </p>
        ) : (
          <>
            <label className="flex flex-col text-sm">
              <span className="mb-1 font-semibold text-[var(--ink-2)]">
                Why every sign-in is ending (at least ten characters)
              </span>
              <input
                className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                name="revoke-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div>
              <button
                type="button"
                className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
                disabled={busy || !reasonOk}
                onClick={() => void signOutEverybody()}
              >
                {busy ? "Ending…" : "End every sign-in"}
              </button>
            </div>
            {said && (
              <p className="text-sm text-[var(--ink-2)]" aria-live="polite">
                {said}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
