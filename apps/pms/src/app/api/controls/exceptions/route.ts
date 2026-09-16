import type { ThresholdException } from "@pms/controls-engine";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { addException, listExceptions } from "@/lib/controls/exceptions";

/** Channel coverage (enforced / recorded / external / off) and the standing exceptions. */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const view = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      listExceptions(db, user.tenantId)
    );
    return Response.json(view);
  },
  { minRank: "manager" }
);

/**
 * Adds a threshold exception as a new policy version. A raise or waiver
 * needs a residual note and a window; every waiver expires within 90 days.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => null)) as Partial<ThresholdException> | null;
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Exception body is required." }, { status: 400 });
    }
    const user = ctx.access.user;
    const exception: ThresholdException = {
      id: String(body.id ?? ""),
      label: String(body.label ?? ""),
      channels: Array.isArray(body.channels) ? (body.channels as ThresholdException["channels"]) : [],
      action: body.action as ThresholdException["action"],
      thresholdUsd: body.thresholdUsd,
      payeeContains: body.payeeContains,
      personId: body.personId,
      role: body.role,
      amountMinUsd: body.amountMinUsd,
      amountMaxUsd: body.amountMaxUsd,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      enabled: body.enabled ?? true,
      reason: String(body.reason ?? ""),
      approvedByPersonId: body.approvedByPersonId,
      createdAt: "",
      residualNote: body.residualNote,
    };
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      addException(db, { tenantId: user.tenantId, actor: { id: user.id, name: user.displayName }, exception })
    );
    if (!result.ok) {
      return Response.json({ error: "The exception was not added.", code: result.code, errors: result.errors }, {
        status: result.status,
      });
    }
    return Response.json(result, { status: 201 });
  },
  { minRank: "admin" }
);
