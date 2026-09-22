import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { loadActivePolicy } from "@/lib/controls/policy";

export const GET = withGuard(
  async (_req, ctx) => {
    const active = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      async (db) => loadActivePolicy(db, ctx.access.user.tenantId)
    );
    if (!active) {
      return Response.json({ error: "No control policy is configured for this practice." }, { status: 404 });
    }
    return Response.json({
      version: active.version,
      rulebookVersion: active.rulebookVersion,
      policy: active.policy,
    });
  },
  /**
   * Manager, as Practice Risk is (Increment 1.96).
   *
   * This route answers with the practice's control policy — the dual-release
   * thresholds among it — and it stood at `user` rank while
   * `GET /api/controls/risk`, which shows the same material on a screen,
   * needs `manager`. The figure a control enforces is exactly what somebody
   * structuring payments beneath it would want, so the looser of two doors
   * onto one thing is the one that decides.
   *
   * Nothing calls this route, which is why the gap sat unread; the sweep in
   * `check-route-guards.mjs` now says so out loud rather than leaving it to
   * be noticed.
   */
  { minRank: "manager" }
);
