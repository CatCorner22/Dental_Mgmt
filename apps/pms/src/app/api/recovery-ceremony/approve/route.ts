import { withGuard } from "@/lib/auth/withGuard";
import { approveRecoveryCeremony } from "@/lib/auth/recoveryCeremony";
import { getAuthStore } from "@/lib/auth/resolveStore";

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
    return Response.json({ ok: true, resetToken: result.resetToken });
  },
  { minRank: "admin" }
);
