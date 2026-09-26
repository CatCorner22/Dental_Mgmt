import type { ReactNode } from "react";
import Link from "next/link";
import { currentSeat } from "@/lib/auth/currentSeat";
import { navLinksFor } from "@/lib/auth/seats";
import { APP_INCREMENT } from "@/lib/product";

/**
 * The header names who is signed in, so these pages cannot be built once and
 * served to everyone: a layout prerendered at build time has no session and
 * would render an empty header for every viewer — which is exactly what the
 * first browser drive of the outside accountant's seat found. Each page under
 * this layout is rendered on demand; they are client screens reading guarded
 * routes, so nothing was being served from a static shell anyway.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  /**
   * The seat itself, not only its links (Increment 1.81). A header that simply
   * emptied was the second half of this product's worst sentence: four screens
   * told a person whose session had ended that their seat worked "from the
   * links in the header", and the same fact had just taken those links away. A
   * reader who cannot be resolved is offered the one thing that would help.
   *
   * Branching on the seat rather than on the length of the list matters: a
   * seat can legitimately hold no links, and that reader is signed in.
   */
  const seat = await currentSeat();
  const links = navLinksFor(seat);
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold" aria-label="Screens">
            {links.map((link) => (
              <Link
                key={link.href}
                className="text-[var(--link)] underline-offset-2 hover:underline"
                href={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            {/* Outside the nav, because this is not one of the screens a rank
                or a grant opens (Increment 1.76): every signed-in person may
                re-pair their own authenticator, and `navLinksFor` answers a
                different question. Without a way in, the act would exist and
                nobody would find it — which is what Increments 1.72 and 1.74
                were both about. */}
            {seat ? (
              <Link
                className="text-xs text-[var(--link)] underline-offset-2 hover:underline"
                href="/enroll-mfa"
              >
                Your authenticator
              </Link>
            ) : (
              <Link
                className="text-xs font-semibold text-[var(--link)] underline-offset-2 hover:underline"
                href="/signin"
              >
                Sign in
              </Link>
            )}
            <p className="text-xs text-[var(--ink-3)]">Money Desk · Increment {APP_INCREMENT}</p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
