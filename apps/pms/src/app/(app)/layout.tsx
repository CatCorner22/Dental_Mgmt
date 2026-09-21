import type { ReactNode } from "react";
import Link from "next/link";
import { getAuthPorts } from "@/lib/auth/resolveStore";
import { getSessionIdFromAuth } from "@/lib/auth/sessionId";
import { isRole } from "@/lib/auth/roles";
import { navLinksFor, type Seat } from "@/lib/auth/seats";

/**
 * The header names who is signed in, so these pages cannot be built once and
 * served to everyone: a layout prerendered at build time has no session and
 * would render an empty header for every viewer — which is exactly what the
 * first browser drive of the outside accountant's seat found. Each page under
 * this layout is rendered on demand; they are client screens reading guarded
 * routes, so nothing was being served from a static shell anyway.
 */
export const dynamic = "force-dynamic";

/**
 * Reads the viewer for the header alone: the session cookie, the session row,
 * and the user row. It writes nothing and sets no tenant context, because the
 * header shows the viewer only what the viewer already knows about itself;
 * every screen behind these links still guards itself through `withGuard`.
 *
 * A viewer this cannot resolve is offered no links rather than every link,
 * which is the default-deny the rest of the product keeps.
 */
async function currentSeat(): Promise<Seat | null> {
  try {
    const ports = await getAuthPorts(getSessionIdFromAuth);
    if (!ports) return null;
    const sessionId = await ports.getSessionId(new Request("http://localhost/"));
    if (!sessionId) return null;
    const session = await ports.getSession(sessionId);
    if (!session || session.revokedAt) return null;
    const user = await ports.getUser(session.userId);
    if (!user || !user.active || user.tenantId !== session.tenantId) return null;
    if (!isRole(user.role)) return null;
    return { role: user.role, entitlements: user.entitlements };
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const links = navLinksFor(await currentSeat());
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
            <Link
              className="text-xs text-[var(--link)] underline-offset-2 hover:underline"
              href="/enroll-mfa"
            >
              Your authenticator
            </Link>
            <p className="text-xs text-[var(--ink-3)]">Money Desk · Increment 1.76</p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
