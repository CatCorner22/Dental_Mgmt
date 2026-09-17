import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listLocations } from "@/lib/locations/service";

/** The practice's locations with their timezone and business hours. Manager rank and above. */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const items = await withTenantTransaction(user.tenantId, user.id, (db) => listLocations(db, user.tenantId));
    return Response.json({ items });
  },
  { minRank: "manager" }
);
