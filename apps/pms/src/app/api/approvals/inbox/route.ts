import type { AfterHoursFacts } from "@pms/ledger";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listInboxApprovals } from "@/lib/controls/approvals";
import { afterHoursLine } from "@/lib/ledger/post";

/**
 * Pending dual-release requests the viewer may decide, each with why it was
 * held (the evaluator's first reason) and, for an after-hours hold, the
 * clock and the location's window at the time of posting (Increment 1.30).
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const rows = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      async (db) => listInboxApprovals(db, ctx.access.user.tenantId, ctx.access.user.id)
    );
    return Response.json({
      items: rows.map((row) => {
        const afterHours = (row.heldPayload as { afterHours?: AfterHoursFacts | null }).afterHours ?? null;
        return {
          id: row.id,
          channel: row.channel,
          kind: row.heldPayload.kind,
          amountCents: row.amountCents,
          status: row.status,
          requesterName: row.requesterName,
          requestedAt: row.requestedAt.toISOString(),
          subjectId: row.subjectId,
          why: row.evaluation?.reasons?.[0] ?? null,
          afterHours: afterHours ? afterHoursLine(afterHours) : null,
        };
      }),
    });
  },
  { entitlements: ["approve_writeoffs"] }
);
