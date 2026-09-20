"use client";

import { useActionState } from "react";
import { stopAction } from "@/lib/notices/stopAction";
import { initialStopState } from "@/lib/notices/stopFormState";

/**
 * The button that acts (Increment 1.67).
 *
 * The page around it only reads. A link that refused on being fetched would
 * hand every mail scanner and link previewer a button it presses on its
 * owner's behalf, so the GET shows and this POST acts.
 */
export function StopForm({ reference }: { reference: string }) {
  const [state, formAction, pending] = useActionState(stopAction, initialStopState);

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
      <button
        id="stop-submit"
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Telling them…" : "I did not ask for this"}
      </button>
      <p className="text-sm text-[var(--ink-2)]">
        This cannot be undone. Nothing here signs you in, and nothing here creates an account.
      </p>
    </form>
  );
}
