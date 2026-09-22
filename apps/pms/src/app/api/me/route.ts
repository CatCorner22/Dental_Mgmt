import { withGuard } from "@/lib/auth/withGuard";
import { APP_INCREMENT } from "@/lib/product";

/**
 * Who the caller is, to the caller alone: the screens read it to decide what
 * to offer, never what to permit.
 *
 * It answers at the lowest rank the product has, because a seat that cannot
 * learn its own name cannot be shown a screen at all — which is what the
 * outside accountant would meet otherwise (Increment 1.49). Nothing here
 * belongs to anyone but the caller, so the rank costs nothing.
 */
export const GET = withGuard(async (_req, ctx) => {
  const { user, session } = ctx.access;
  return Response.json({
    ok: true,
    increment: APP_INCREMENT,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    entitlements: user.entitlements,
    tenantId: user.tenantId,
    sessionId: session.id,
  });
}, { minRank: "readonly" });
