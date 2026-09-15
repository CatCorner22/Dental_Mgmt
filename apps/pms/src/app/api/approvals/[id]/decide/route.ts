import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { decideApprovalRequest, getApprovalRequest } from "@/lib/controls/approvals";
import { executeHeldPosting } from "@/lib/controls/postHeld";

type Body = {
  decision?: "approved" | "declined";
  reason?: string;
};

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

    const existing = await withTenantTransaction(tenantId, user.id, async (db) =>
      getApprovalRequest(db, tenantId, id)
    );
    if (!existing) return Response.json({ error: "Approval request not found." }, { status: 404 });
    if (existing.requesterId === user.id) {
      return Response.json({ error: "Requester cannot approve their own request." }, { status: 403 });
    }

    if (body.decision === "declined") {
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

    const posted = await executeHeldPosting(tenantId, user.id, existing, user.id);
    if (!posted.ok) {
      return Response.json(
        {
          error: posted.why,
          code: posted.code,
          verb: posted.verb,
          control: posted.control,
        },
        { status: 403 }
      );
    }

    const decided = await withTenantTransaction(tenantId, user.id, async (db) =>
      decideApprovalRequest(db, {
        tenantId,
        requestId: id,
        approverId: user.id,
        approverName: user.displayName,
        decision: "approved",
        resultingEntryId: posted.entry.id,
      })
    );
    if (!decided.ok) {
      return Response.json({ error: "Approval request is no longer pending." }, { status: 409 });
    }

    return Response.json({
      ok: true,
      status: "approved",
      requestId: id,
      entryId: posted.entry.id,
    });
  },
  { entitlements: ["approve_writeoffs"] }
);
