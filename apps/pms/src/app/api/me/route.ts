import { withGuard } from "@/lib/auth/withGuard";

export const GET = withGuard(async (_req, ctx) => {
  const { user, session } = ctx.access;
  return Response.json({
    ok: true,
    increment: "0.4",
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    tenantId: user.tenantId,
    sessionId: session.id,
  });
}, { minRank: "user" });
