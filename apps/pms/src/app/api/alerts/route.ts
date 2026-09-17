import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { attachAcks, loadHardEventAcks, summarizeAcks } from "@/lib/alerts/acks";
import { countByKind, HARD_EVENT_ASSUMPTIONS, HARD_EVENT_DAYS, HARD_EVENT_LABEL, listHardEvents } from "@/lib/alerts/hardEvents";

/**
 * The six hard events over the last seven days, computed from rows on
 * every read, each with the owner's acknowledgment if one exists
 * (Increment 1.33). These page the owner one at a time, so the route is
 * for the administrator rank; everything else waits for the weekly digest.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const now = new Date();
    const since = new Date(now.getTime() - HARD_EVENT_DAYS * 86_400_000);
    const items = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      attachAcks(await listHardEvents(db, user.tenantId, { since, now }), await loadHardEventAcks(db, user.tenantId, since))
    );
    return Response.json({
      since: since.toISOString(),
      days: HARD_EVENT_DAYS,
      items,
      counts: countByKind(items),
      acknowledgments: summarizeAcks(items),
      labels: HARD_EVENT_LABEL,
      assumptions: HARD_EVENT_ASSUMPTIONS,
      computedAt: now.toISOString(),
    });
  },
  { minRank: "admin" }
);
