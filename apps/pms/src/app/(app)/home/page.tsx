import { SessionStatus } from "./session-status";

export const metadata = { title: "Practice home" };

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-3 text-sm font-semibold tracking-wide text-teal">Practice home</p>
      <h1 className="mb-4 text-navy">Nothing on the Board yet</h1>
      <p className="max-w-prose text-[var(--ink-2)]">
        Phase 1 money layer is live beside the incumbent: read the guarantor
        ledger, import bank statements for independent reconciliation, and open
        the variance queue when deposits do not tie.
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        <a
          className="inline-flex min-h-[var(--target)] items-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 font-semibold text-[var(--ink)]"
          href="/ledger"
        >
          Open ledger
        </a>
        <a
          className="inline-flex min-h-[var(--target)] items-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 font-semibold text-[var(--ink)]"
          href="/reconciliation"
        >
          Bank reconciliation
        </a>
      </div>
      <div className="mt-6">
        <SessionStatus />
      </div>
    </main>
  );
}
