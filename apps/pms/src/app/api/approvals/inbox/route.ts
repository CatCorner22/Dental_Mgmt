import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listInboxApprovals } from "@/lib/controls/approvals";

export const GET = withGuard(
  async (_req, ctx) => {
    const rows = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      async (db) => listInboxApprovals(db, ctx.access.user.tenantId, ctx.access.user.id)
    );
    return Response.json({
      items: rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        amountCents: row.amountCents,
        status: row.status,
        requesterName: row.requesterName,
        requestedAt: row.requestedAt.toISOString(),
        subjectId: row.subjectId,
      })),
    });
  },
  { entitlements: ["approve_writeoffs"] }
);
