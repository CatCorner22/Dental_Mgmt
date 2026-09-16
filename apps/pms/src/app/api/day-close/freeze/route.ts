import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { freezeDayClose } from "@/lib/day-close/service";

type FreezeBody = {
  locationId?: string;
  businessDate?: string;
};

export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json()) as FreezeBody;
    if (!body.locationId || !body.businessDate) {
      return Response.json({ error: "locationId and businessDate are required." }, { status: 400 });
    }

    const result = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) =>
        freezeDayClose(db, {
          tenantId: ctx.access.user.tenantId,
          locationId: body.locationId!,
          businessDate: body.businessDate!,
          actorUserId: ctx.access.user.id,
          actorName: ctx.access.user.displayName,
        })
    );

    if ("error" in result) {
      const status = result.error === "already_frozen" ? 409 : 400;
      return Response.json({ error: result.error }, { status });
    }

    return Response.json({ snapshot: result });
  },
  { entitlements: ["bank_reconcile"] }
);
