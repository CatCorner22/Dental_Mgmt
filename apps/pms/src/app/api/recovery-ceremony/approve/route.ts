import { withGuard } from "@/lib/auth/withGuard";
import { approveRecoveryCeremony } from "@/lib/auth/recoveryCeremony";
import { regainUrl } from "@/lib/auth/regainLink";
import { getAuthStore } from "@/lib/auth/resolveStore";

/**
 * The second administrator approves, and receives the one link that opens the
 * account (Increment 1.77 gave that link a page).
 *
 * The link is handed back once, by this call, and never again: the row keeps a
 * SHA-256 of the token, so a practice that mislaid a link starts the ceremony
 * again rather than asking this product to repeat a secret it does not hold.
 * That is the same rule the invitation link has held since Increment 1.73.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const store = await getAuthStore();
    if (!store) {
      return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
    }
    const body = (await req.json().catch(() => ({}))) as { ceremonyId?: unknown; totp?: unknown };
    const ceremonyId = typeof body.ceremonyId === "string" ? body.ceremonyId : "";
    const totp = typeof body.totp === "string" ? body.totp.trim() : "";
    if (!ceremonyId || !totp) {
      return Response.json({ error: "ceremonyId and totp are required." }, { status: 400 });
    }
    const approver = await store.getUserById(ctx.access.user.id);
    if (!approver) {
      return Response.json({ error: "This account is not active." }, { status: 403 });
    }
    const result = await approveRecoveryCeremony(store, approver, ceremonyId, totp, new Date());
    if (!result.ok) {
      return Response.json({ error: "Could not approve recovery." }, { status: 400 });
    }
    return Response.json({ ok: true, link: regainUrl(new URL(req.url).origin, result.resetToken) });
  },
  { minRank: "admin" }
);
