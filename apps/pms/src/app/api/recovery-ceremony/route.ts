import { withGuard } from "@/lib/auth/withGuard";
import { initiateRecoveryCeremony } from "@/lib/auth/recoveryCeremony";
import { getAuthStore } from "@/lib/auth/resolveStore";

export const POST = withGuard(
  async (req, ctx) => {
    const store = await getAuthStore();
    if (!store) {
      return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
    }
    const body = (await req.json().catch(() => ({}))) as { targetUserId?: unknown; totp?: unknown };
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    const totp = typeof body.totp === "string" ? body.totp.trim() : "";
    if (!targetUserId || !totp) {
      return Response.json({ error: "targetUserId and totp are required." }, { status: 400 });
    }
    const initiator = await store.getUserById(ctx.access.user.id);
    if (!initiator) {
      return Response.json({ error: "This account is not active." }, { status: 403 });
    }
    const result = await initiateRecoveryCeremony(store, initiator, targetUserId, totp, new Date());
    if (!result.ok) {
      return Response.json({ error: "Could not start recovery." }, { status: 400 });
    }
    return Response.json({ ok: true, ceremonyId: result.ceremonyId });
  },
  { minRank: "admin" }
);
