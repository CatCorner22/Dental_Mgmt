import { withGuard } from "@/lib/auth/withGuard";
import { beginMfaEnrollment, completeMfaEnrollment } from "@/lib/auth/enrollMfa";
import { getAuthStore } from "@/lib/auth/resolveStore";

/**
 * Setting up one's own second factor, at any rank (Increment 1.72).
 *
 * This route used to open at `user` rank, which silently excluded the one seat
 * that sits below it. The outside accountant is `readonly` by construction —
 * `isCpaSeat` is exactly "holds the reporting grant and does **not** meet
 * `user`" (Increment 1.49) — so that seat could never enrol a second factor,
 * and an account that cannot enrol can never finish a first sign-in. The
 * middleware sends every unenrolled session to `/enroll-mfa`, so the seat
 * arrived at a screen whose only control answered "You do not have access to
 * this action", with no way forward and nothing to say what was wrong.
 *
 * Nothing hid it until Increment 1.71, because the only `readonly` account in
 * the fixtures was seeded already enrolled. The first seat a practice created
 * for itself was also the first that had to enrol.
 *
 * So the rank comes off, deliberately rather than by omission: enrolling one's
 * own second factor is not an action rank should weigh. It is how an account
 * becomes usable at all, it acts on nobody else, and a rank that gates it
 * gates signing in. `readonly` is the lowest rank the product has, so this
 * admits every signed-in account and no more; `requireMfa: false` is what lets
 * an unenrolled session through at all, and the session is still the thing
 * being trusted.
 */

export const GET = withGuard(
  async (_req, ctx) => {
    const store = await getAuthStore();
    if (!store) {
      return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
    }
    const start = await beginMfaEnrollment(store, ctx.access.user.id);
    return Response.json({ ok: true, otpauthUri: start.otpauthUri });
  },
  { requireMfa: false, minRank: "readonly" }
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
      return Response.json(
        { ok: false, error: "Could not verify the authenticator code." },
        { status: 400 }
      );
    }
    await store.revokeSessionsForUser(ctx.access.user.id, new Date());
    return Response.json({ ok: true, recoveryCodes: result.recoveryCodes, signOut: true });
  },
  { requireMfa: false, minRank: "readonly" }
);
