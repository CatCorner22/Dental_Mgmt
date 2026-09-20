"use client";

import { useActionState } from "react";
import { inviteAction } from "@/lib/auth/inviteAction";
import { initialInviteState } from "@/lib/auth/inviteFormState";
import { PASSWORD_MIN } from "@/lib/auth/password";

/**
 * Where the invited person sets the secret the practice never learns
 * (Increment 1.71).
 *
 * The page around it only reads, as the stop page's does: a link that opened
 * an account on being fetched would hand every mail scanner a button it
 * presses on its owner's behalf. The GET shows and this POST acts.
 */
export function InviteForm({ reference, username }: { reference: string; username: string }) {
  const [state, formAction, pending] = useActionState(inviteAction, initialInviteState);

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
        You will sign in as <strong>{username}</strong>.
      </p>
      <label htmlFor="invite-password" className="text-sm font-semibold text-[var(--ink)]">
        Choose a password
      </label>
      <input
        id="invite-password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-2"
      />
      <label htmlFor="invite-confirm" className="text-sm font-semibold text-[var(--ink)]">
        Type it again
      </label>
      <input
        id="invite-confirm"
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
        id="invite-submit"
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Opening your seat…" : "Set my password"}
      </button>
      <p className="text-sm text-[var(--ink-2)]">
        At least {PASSWORD_MIN} characters. The practice never sees it and cannot set it for you.
      </p>
    </form>
  );
}
