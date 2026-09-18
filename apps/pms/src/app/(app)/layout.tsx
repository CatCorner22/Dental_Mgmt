import type { ReactNode } from "react";
import Link from "next/link";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold">
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/home">
              Home
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/ledger">
              Ledger
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/ledger/post">
              Post
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/reconciliation">
              Reconciliation
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/day-close">
              Day close
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/statements">
              Statements
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/approvals">
              Approvals
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/risk">
              Practice Risk
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/digest">
              Digest
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/locations">
              Locations
            </Link>
            <Link className="text-[var(--link)] underline-offset-2 hover:underline" href="/cpa">
              Month-end
            </Link>
          </nav>
          <p className="text-xs text-[var(--ink-3)]">Money Desk · Increment 1.44</p>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
