import { withGuard } from "@/lib/auth/withGuard";
import { beginMfaEnrollment, completeMfaEnrollment } from "@/lib/auth/enrollMfa";
import { getAuthStore } from "@/lib/auth/resolveStore";

export const GET = withGuard(
  async (_req, ctx) => {
    const store = await getAuthStore();
    if (!store) {
      return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
    }
    const start = await beginMfaEnrollment(store, ctx.access.user.id);
    if (!start.ok) {
      if (start.reason === "already_enrolled") {
        return Response.json({ ok: false, error: "MFA is already enrolled." }, { status: 409 });
      }
      return Response.json({ ok: false, error: "User not found." }, { status: 404 });
    }
    return Response.json({ ok: true, otpauthUri: start.otpauthUri });
  },
  { requireMfa: false, minRank: "user" }
);

export const POST = withGuard(
  async (req, ctx) => {
    const store = await getAuthStore();
    if (!store) {
      return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
    }
    const body = (await req.json().catch(() => ({}))) as { totp?: unknown };
    const totp = typeof body.totp === "string" ? body.totp.trim() : "";
    const result = await completeMfaEnrollment(store, ctx.access.user.id, totp);
    if (!result.ok) {
      if (result.reason === "already_enrolled") {
        return Response.json({ ok: false, error: "MFA is already enrolled." }, { status: 409 });
      }
      return Response.json(
        { ok: false, error: "Could not verify the authenticator code." },
        { status: 400 }
      );
    }
    await store.revokeSessionsForUser(ctx.access.user.id, new Date());
    return Response.json({ ok: true, recoveryCodes: result.recoveryCodes, signOut: true });
  },
  { requireMfa: false, minRank: "user" }
);
