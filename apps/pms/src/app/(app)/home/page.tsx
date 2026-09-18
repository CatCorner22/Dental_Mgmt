import { OwnerBoard } from "./owner-board";
import { SessionStatus } from "./session-status";

export const metadata = { title: "Practice home" };

const LINKS: { href: string; label: string }[] = [
  { href: "/ledger", label: "Open ledger" },
  { href: "/ledger/post", label: "Post payment" },
  { href: "/reconciliation", label: "Bank reconciliation" },
  { href: "/day-close", label: "Day close" },
  { href: "/statements", label: "Statements" },
  { href: "/approvals", label: "Approvals inbox" },
  { href: "/risk", label: "Practice Risk" },
  { href: "/digest", label: "Weekly digest" },
  { href: "/locations", label: "Locations" },
  { href: "/reason-codes", label: "Reason codes" },
  { href: "/cpa", label: "Month-end package" },
];

export default function HomePage() {
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
        {LINKS.map((l) => (
          <a
            key={l.href}
            className="inline-flex min-h-[var(--target)] items-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 font-semibold text-[var(--ink)]"
            href={l.href}
          >
            {l.label}
          </a>
        ))}
      </div>
      <div className="mt-6">
        <SessionStatus />
      </div>
    </main>
  );
}
