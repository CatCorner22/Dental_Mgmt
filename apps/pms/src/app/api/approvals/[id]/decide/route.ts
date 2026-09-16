import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { decideApprovalRequest, getApprovalRequest } from "@/lib/controls/approvals";
import { approveAndPost } from "@/lib/controls/decideAndPost";

type Body = {
  decision?: "approved" | "declined";
  reason?: string;
};

/**
 * The second person's decision on a held posting. Approval is recorded
 * first, the ledger posts second (the database re-checks the request on
 * insert), and the entry is attached to the request last. A refused
 * posting cancels the approval with the refusal as its reason.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const params = await ctx.params;
    const id = typeof params.id === "string" ? params.id : params.id?.[0];
    if (!id) return Response.json({ error: "Missing approval id." }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as Body;
    if (body.decision !== "approved" && body.decision !== "declined") {
      return Response.json({ error: "Decision must be approved or declined." }, { status: 400 });
    }

    const tenantId = ctx.access.user.tenantId;
    const user = ctx.access.user;

    if (body.decision === "declined") {
      const existing = await withTenantTransaction(tenantId, user.id, async (db) =>
        getApprovalRequest(db, tenantId, id)
      );
      if (!existing) return Response.json({ error: "Approval request not found." }, { status: 404 });
      if (existing.requesterId === user.id) {
        return Response.json({ error: "Requester cannot decide their own request." }, { status: 403 });
      }
      const declined = await withTenantTransaction(tenantId, user.id, async (db) =>
        decideApprovalRequest(db, {
          tenantId,
          requestId: id,
          approverId: user.id,
          approverName: user.displayName,
          decision: "declined",
          reason: body.reason,
        })
      );
      if (!declined.ok) {
        if (declined.reason === "decline_reason_required") {
          return Response.json({ error: "Decline requires a reason." }, { status: 400 });
        }
        return Response.json({ error: "Approval request is no longer pending." }, { status: 409 });
      }
      return Response.json({ ok: true, status: "declined", requestId: id });
    }

    const result = await approveAndPost(tenantId, { id: user.id, name: user.displayName }, id);
    if (!result.ok) {
      return Response.json(
        {
          error: result.why,
          code: result.code,
          verb: result.verb,
          control: result.control,
          cancelled: result.cancelled ?? false,
        },
        { status: result.status }
      );
    }
    return Response.json({ ok: true, status: "approved", requestId: id, entryId: result.entryId });
  },
  { entitlements: ["approve_writeoffs"] }
);
