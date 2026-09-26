"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  readEnrollmentFinish,
  readEnrollmentStart,
  type EnrollmentFinish,
  type EnrollmentStart,
} from "@/lib/auth/enrollmentGate";

/** The one way off this screen, wherever it is offered. */
function toSignIn(): void {
  // Signing out twice is harmless, and by the time the codes are on screen the
  // session has usually ended already (Increment 1.80) — so this call is the
  // deliberate exit rather than the thing that ends anything. It navigates; if
  // the POST cannot be made at all, the person still goes to the door.
  void signOut({ callbackUrl: "/signin?ready=1" }).catch(() => {
    window.location.href = "/signin?ready=1";
  });
}

export function EnrollMfaForm() {
  // Null while the route has not answered. Its three readings are the three
  // things this screen can be: a pairing to finish, a session that is gone,
  // and a failure a person can still act on where they stand.
  const [start, setStart] = useState<EnrollmentStart | null>(null);
  const [done, setDone] = useState<(EnrollmentFinish & { state: "done" }) | null>(null);
  // Set from either route. Non-empty means nothing on this screen can work.
  const [ended, setEnded] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let read: EnrollmentStart;
      try {
        const res = await fetch("/api/enroll-mfa");
        read = readEnrollmentStart(res.status, await res.json().catch(() => ({})));
      } catch {
        read = { state: "failed", why: "Could not start enrollment." };
      }
      if (cancelled) return;
      setStart(read);
      if (read.state === "ended") setEnded(read.why);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/enroll-mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ totp }),
      });
      const read = readEnrollmentFinish(res.status, await res.json().catch(() => ({})));
      if (read.state === "ended") {
        setEnded(read.why);
        return;
      }
      if (read.state === "failed") {
        setError(read.why);
        return;
      }
      setDone(read);
      if (read.endSession) {
        // The route revoked every session row for this account, because not one
        // of them passed the factor the account now has. The browser's half of
        // the same session ends here, in the same breath, rather than waiting
        // for the button below to be pressed: a cookie that outlived its row
        // went on telling the middleware this account still owed a second
        // factor, and the middleware pinned it to this screen — whose route
        // then refused it, because the session was gone. The codes stay on
        // screen throughout, which is why nothing is redirected here.
        await signOut({ redirect: false }).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.");
    } finally {
      setPending(false);
    }
  }

  // The codes outrank everything: they exist in one place, on this screen,
  // once. A session that has just ended is the expected state behind them.
  if (done) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-[var(--ink-2)]">
          Save these recovery codes somewhere safe. Each code works once if you lose your phone.
          {done.repaired
            ? " This is a new set: any codes you had before this no longer work, and neither does the authenticator you replaced."
            : ""}
        </p>
        <ul className="grid gap-1 rounded-[var(--radius)] bg-white p-3 font-mono text-sm ring-1 ring-[var(--line)]">
          {done.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={toSignIn}
          className="rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white"
        >
          Continue to sign in
        </button>
      </div>
    );
  }

  // Increment 1.80. This is what a person met as one error line and a button
  // that could not be pressed, on the one address the gate would let them
  // reach. It now says what happened and carries the way out.
  if (ended) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-[var(--ink-2)]" role="alert">
          {ended}
        </p>
        <button
          type="button"
          onClick={toSignIn}
          className="rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white"
        >
          Go to sign in
        </button>
      </div>
    );
  }

  const ready = start?.state === "ready" ? start : null;
  const repairing = ready?.repairing === true;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {start === null ? (
        <p className="text-sm text-[var(--ink-2)]">Preparing your authenticator setup…</p>
      ) : (
        <>
          <p className="text-sm text-[var(--ink-2)]">
            {repairing
              ? "Add this account to your authenticator app. The one on your old phone keeps working until you bring back a code from the new one — until then nothing has changed."
              : "Add this account to your authenticator app. In most apps you can paste the setup URI below if scanning is not available."}
          </p>
          {/* Focusable and named, because it scrolls sideways: a keyboard user
              who cannot reach it cannot read the one string this screen exists
              to hand over, and their enrolment stops there. Increment 1.72 —
              found by an axe audit that only ran once a seat reached this
              screen for the first time. */}
          <code
            tabIndex={0}
            aria-label="Authenticator setup URI"
            className="block overflow-x-auto rounded-[var(--radius)] bg-[var(--surface)] p-3 text-xs"
          >
            {ready?.otpauthUri ?? ""}
          </code>
          <label className="grid gap-1 text-sm">
            <span>Enter the six-digit code from your app</span>
            <input
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={totp}
              onChange={(event) => setTotp(event.target.value)}
              className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-white px-3 text-[var(--ink)]"
            />
          </label>
        </>
      )}
      <button
        type="submit"
        disabled={pending || start === null || !ready}
        className="rounded-[var(--radius)] bg-navy px-4 font-semibold text-white disabled:opacity-70"
      >
        {pending ? "Verifying…" : repairing ? "Replace my authenticator" : "Finish enrollment"}
      </button>
      {/* A person re-pairing arrived by choice and may leave the same way. One
          finishing a first enrolment may not: the middleware holds them here
          until the account has a factor, which is the whole of that gate. */}
      {repairing ? (
        <a className="text-center text-sm text-[var(--link)] underline-offset-2 hover:underline" href="/home">
          Leave this as it is
        </a>
      ) : null}
      {error || start?.state === "failed" ? (
        <p className="text-sm text-[var(--ink-2)]" role="alert">
          {error || (start?.state === "failed" ? start.why : "")}
        </p>
      ) : null}
    </form>
  );
}
