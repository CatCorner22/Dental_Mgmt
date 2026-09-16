import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { getDayCloseSnapshot } from "@/lib/day-close/service";

export const GET = withGuard(
  async (req, ctx) => {
    const url = new URL(req.url);
    const locationId = url.searchParams.get("locationId");
    const businessDate = url.searchParams.get("businessDate");
    if (!locationId || !businessDate) {
      return Response.json({ error: "locationId and businessDate are required." }, { status: 400 });
    }

    const snapshot = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => getDayCloseSnapshot(db, ctx.access.user.tenantId, locationId, businessDate)
    );

    return Response.json({ snapshot });
  },
  { minRank: "user" }
);
