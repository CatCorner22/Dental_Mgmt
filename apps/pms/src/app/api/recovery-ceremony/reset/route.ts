import { requestSurfaceOk } from "@/lib/http/checks";
import { consumeRecoveryCeremony } from "@/lib/auth/recoveryCeremony";
import { getAuthStore } from "@/lib/auth/resolveStore";

/** Completes an approved two-admin recovery with the one-time token. No session required. */
export async function POST(req: Request) {
  const surface = requestSurfaceOk(req);
  if (!surface.ok) {
    return Response.json({ error: surface.error }, { status: surface.status });
  }
  const store = await getAuthStore();
  if (!store) {
    return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { resetToken?: unknown; password?: unknown };
  const resetToken = typeof body.resetToken === "string" ? body.resetToken.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!resetToken || !password) {
    return Response.json({ error: "resetToken and password are required." }, { status: 400 });
  }
  const result = await consumeRecoveryCeremony(store, resetToken, password, new Date());
  if (!result.ok) {
    return Response.json({ error: "Could not reset the password." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
