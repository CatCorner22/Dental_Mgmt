import { getAuthPorts } from "./resolveStore";
import { getSessionIdFromAuth } from "./sessionId";
import { isRole } from "./roles";
import type { Seat } from "./seats";

/**
 * The viewer, for server-rendered chrome (Increment 1.104 moved it here).
 *
 * It writes nothing and sets no tenant context, because the chrome shows the
 * viewer only what the viewer already knows about itself; every screen behind
 * these links still guards itself through `withGuard`.
 *
 * A viewer this cannot resolve is offered no links rather than every link,
 * which is the default-deny the rest of the product keeps.
 *
 * It lived inside the app layout until the owner's home board needed the same
 * reader. Two readers of the viewer would be two answers to "who is this", and
 * the board's second answer to the neighbouring question — which screens may
 * this seat reach — is the whole of what Increment 1.104 fixes.
 */
export async function currentSeat(): Promise<Seat | null> {
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
