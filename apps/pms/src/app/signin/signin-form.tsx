"use client";

import { useState } from "react";

export function SignInForm() {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(
          "Sign-in reaches Postgres once the tenant is seeded. MFA stays mandatory."
        );
      }}
    >
      <label className="grid gap-1 text-sm">
        <span>Username</span>
        <input
          name="username"
          autoComplete="username"
          className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-white px-3 text-[var(--ink)]"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-white px-3 text-[var(--ink)]"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Authenticator code</span>
        <input
          name="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-white px-3 text-[var(--ink)]"
        />
      </label>
      <button
        type="submit"
        className="rounded-[var(--radius)] bg-navy px-4 font-semibold text-white"
      >
        Sign in
      </button>
      {message ? <p className="text-sm text-[var(--ink-2)]">{message}</p> : null}
    </form>
  );
}
