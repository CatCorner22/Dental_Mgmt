"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export function EnrollMfaForm() {
  const [otpauthUri, setOtpauthUri] = useState("");
  const [totp, setTotp] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/enroll-mfa");
        const data = (await res.json()) as { otpauthUri?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not start enrollment.");
        if (!cancelled) setOtpauthUri(data.otpauthUri ?? "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start enrollment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
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
      const data = (await res.json()) as { recoveryCodes?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not verify the code.");
      setRecoveryCodes(data.recoveryCodes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.");
    } finally {
      setPending(false);
    }
  }

  if (recoveryCodes) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-[var(--ink-2)]">
          Save these recovery codes somewhere safe. Each code works once if you lose your phone.
        </p>
        <ul className="grid gap-1 rounded-[var(--radius)] bg-white p-3 font-mono text-sm ring-1 ring-[var(--line)]">
          {recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/signin?ready=1" })}
          className="rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white"
        >
          Continue to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {loading ? (
        <p className="text-sm text-[var(--ink-2)]">Preparing your authenticator setup…</p>
      ) : (
        <>
          <p className="text-sm text-[var(--ink-2)]">
            Add this account to your authenticator app. In most apps you can paste the setup URI
            below if scanning is not available.
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
            {otpauthUri}
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
        disabled={pending || loading || !otpauthUri}
        className="rounded-[var(--radius)] bg-navy px-4 font-semibold text-white disabled:opacity-70"
      >
        {pending ? "Verifying…" : "Finish enrollment"}
      </button>
      {error ? (
        <p className="text-sm text-[var(--ink-2)]" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
