import { currentSeat } from "@/lib/auth/currentSeat";
import { boardLinksFor } from "@/lib/auth/seats";
import { OwnerBoard } from "./owner-board";
import { SessionStatus } from "./session-status";

export const metadata = { title: "Practice home" };


/**
 * The board offers what this seat may actually reach (Increment 1.104).
 *
 * It kept its own list of eleven links with no rank or duty filter, beside a
 * header that has filtered since the seat catalog existed — and whose comment
 * says what the filter is for: "the courtesy of not offering a person eleven
 * screens that refuse them". The board offered eleven. The seeded owner, who
 * holds `approve_writeoffs`, `run_import` and `bank_reconcile` but never
 * `post_payments`, started every day beside a "Post payment" button leading to
 * a screen whose route has always refused them; and the list had never gained
 * `/import` or `/releases`, because a second list is a second thing to keep
 * true. There is one list now.
 */
export default async function HomePage() {
  const links = boardLinksFor(await currentSeat());
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="mb-3 text-sm font-semibold tracking-wide text-teal">Practice home</p>
      <h1 className="mb-6 text-navy">Today&apos;s board</h1>
      <OwnerBoard />
      <h2 className="mt-10 mb-3 text-lg font-semibold">Money Desk</h2>
      <p className="max-w-prose text-[var(--ink-2)]">
        Phase 1 money layer is live beside the incumbent: read the guarantor ledger, issue a patient statement from
        the same balances, import bank statements for independent reconciliation, and open the variance queue when
        deposits do not tie.
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        {links.map((l) => (
          <a
            key={l.href}
            className="inline-flex min-h-[var(--target)] items-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 font-semibold text-[var(--ink)]"
            href={l.href}
          >
            {l.boardLabel ?? l.label}
          </a>
        ))}
      </div>
      <div className="mt-6">
        <SessionStatus />
      </div>
    </main>
  );
}
