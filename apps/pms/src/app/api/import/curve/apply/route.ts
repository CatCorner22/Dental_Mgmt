import { withGuard } from "@/lib/auth/withGuard";
import { withTenantAppendTransaction } from "@/lib/db/client";
import { applyCurveHeroImport, hasValidatedCurveImportRun } from "@/lib/import/apply";

type ApplyBody = {
  runId?: string;
};

export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as ApplyBody;
    const runId = body.runId;
    if (!runId || typeof runId !== "string" || runId.trim().length === 0) {
      return Response.json({ error: "runId is required." }, { status: 400 });
    }

    const exists = await withTenantAppendTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => hasValidatedCurveImportRun(db, ctx.access.user.tenantId, runId)
    );
    if (!exists) {
      return Response.json(
        { error: "Import run not found or not eligible for ledger apply." },
        { status: 404 }
      );
    }

    const result = await withTenantAppendTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) =>
        applyCurveHeroImport(db, {
          tenantId: ctx.access.user.tenantId,
          runId,
          actorUserId: ctx.access.user.id,
          actorName: ctx.access.user.displayName,
        })
    );

    return Response.json(result, { status: 201 });
  },
  { entitlements: ["run_import"] }
);
