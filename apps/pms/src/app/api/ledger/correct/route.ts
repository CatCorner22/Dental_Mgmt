import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { correctEntry } from "@/lib/ledger/correct";

type CorrectBody = {
  entryId?: string;
  amountCents?: number;
  reasonCode?: string;
  memo?: string | null;
};

/**
 * Corrects one posted entry as a reversal-and-repost pair (Increment 1.37).
 * The same entitlement that posts money corrects it; the dual-release policy
 * and the closed-month refusal decide whether the pair lands.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as CorrectBody;
    const entryId = body.entryId?.trim();
    const reasonCode = body.reasonCode?.trim();
    if (!entryId) return Response.json({ error: "entryId is required." }, { status: 400 });
    if (typeof body.amountCents !== "number" || !Number.isFinite(body.amountCents)) {
      return Response.json({ error: "amountCents must be a number." }, { status: 400 });
    }
    if (!reasonCode) return Response.json({ error: "reasonCode is required." }, { status: 400 });

    const amountCents = body.amountCents;
    const result = await withTenantTransaction(ctx.access.user.tenantId, ctx.access.user.id, (db) =>
      correctEntry(db, {
        tenantId: ctx.access.user.tenantId,
        actorId: ctx.access.user.id,
        actorName: ctx.access.user.displayName,
        entryId,
        amountCents,
        reasonCode,
        memo: body.memo ?? null,
      })
    );

    if (result.ok) {
      return Response.json(
        {
          ok: true,
          reversalId: result.reversalId,
          repostId: result.repostId,
          reasonCode: result.reasonCode,
          closedMonth: result.closedMonth,
        },
        { status: 201 }
      );
    }

    // A correction waiting on a second person is not a refusal: the request exists,
    // and approving it writes both halves (Increment 1.38).
    if (result.code === "needs_second") {
      return Response.json(
        {
          ok: false,
          code: result.code,
          approvalRequestId: result.approvalRequestId,
          verb: result.verb,
          control: result.control,
          why: result.why,
        },
        { status: 202 }
      );
    }

    return Response.json(
      { ok: false, code: result.code, verb: result.verb, control: result.control, why: result.why },
      { status: result.code === "entry_not_found" ? 404 : 403 }
    );
  },
  { entitlements: ["post_payments"] }
);
