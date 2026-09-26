"use client";

import { useActionState } from "react";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { regainAction } from "@/lib/auth/regainAction";
import { initialRegainState } from "@/lib/auth/regainFormState";

/**
 * Where the locked-out person sets the secret the practice never learns
 * (Increment 1.77).
 *
 * The same shape as the invitation's form, because it is the same act on a
 * different door: two password fields compared on the server, one submit, and
 * a settled state that shows no fields rather than inviting a second attempt
 * on a link that works once.
 */
export function RegainForm({ reference, displayName }: { reference: string; displayName: string }) {
  const [state, formAction, pending] = useActionState(regainAction, initialRegainState);

  if (state.settled) {
    return (
      <p
        role="status"
        className="rounded-[var(--radius)] bg-[var(--surface)] p-4 text-[var(--ink-2)] ring-1 ring-[var(--line)]"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="ref" value={reference} />
      <p className="text-sm text-[var(--ink-2)]">
        You are setting the password for <strong>{displayName}</strong>.
      </p>
      <label htmlFor="regain-password" className="text-sm font-semibold text-[var(--ink)]">
        Choose a password
      </label>
      <input
        id="regain-password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-2"
      />
      <label htmlFor="regain-confirm" className="text-sm font-semibold text-[var(--ink)]">
        Type it again
      </label>
      <input
        id="regain-confirm"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-2"
      />
      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ink-2)]">
          {state.message}
        </p>
      ) : null}
      <button
        id="regain-submit"
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Setting your password…" : "Set my password"}
      </button>
      <p className="text-sm text-[var(--ink-2)]">
        At least {PASSWORD_MIN} characters. The practice never sees it and cannot set it for you.
      </p>
    </form>
  );
}
