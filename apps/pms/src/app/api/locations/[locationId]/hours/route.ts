import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { updateLocationHours } from "@/lib/locations/service";

type Body = { hours?: unknown };

/**
 * Sets a location's business hours: the week the after-hours hold reads
 * (Increment 1.32). Administrator rank; every change is a chain event.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const params = await ctx.params;
    const locationId = typeof params.locationId === "string" ? params.locationId : params.locationId?.[0];
    if (!locationId) return Response.json({ error: "Missing location id." }, { status: 400 });
    const body = (await req.json().catch(() => ({}))) as Body;
    if (body.hours === undefined) return Response.json({ error: "hours is required." }, { status: 400 });
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, (db) =>
      updateLocationHours(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        locationId,
        hours: body.hours,
      })
    );
    if (!result.ok) {
      return Response.json({ error: "The hours were not saved.", code: result.code, errors: result.errors }, { status: result.status });
    }
    return Response.json(result);
  },
  { minRank: "admin" }
);
