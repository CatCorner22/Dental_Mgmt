"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/lib/auth/loginAction";
import { initialLoginState } from "@/lib/auth/loginFormState";

export function SignInForm({ callbackUrl = "/home" }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginState);
  const [username, setUsername] = useState(state.username);
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <input type="hidden" name="attempts" value={state.attempts} />
      <input type="hidden" name="mfaOffered" value="1" />
      <label className="grid gap-1 text-sm">
        <span>Username</span>
        <input
          id="li-user"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-white px-3 text-[var(--ink)]"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Password</span>
        <input
          id="li-pass"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-white px-3 text-[var(--ink)]"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Authenticator or recovery code</span>
        <input
          id="li-totp"
          name="totp"
          inputMode="text"
          autoComplete="one-time-code"
          value={totp}
          onChange={(event) => setTotp(event.target.value)}
          className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-white px-3 text-[var(--ink)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius)] bg-navy px-4 font-semibold text-white disabled:opacity-70"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state.error ? (
        <p className="text-sm text-[var(--ink-2)]" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
