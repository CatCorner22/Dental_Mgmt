import { withGuard } from "@/lib/auth/withGuard";
import { withTenantAppendTransaction, withTenantTransaction } from "@/lib/db/client";
import { hasValidatedCurveImportRun, planCurveHeroImport, writeCurveHeroImport } from "@/lib/import/apply";

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

    /**
     * Read as `app_rw`, write as `app_append` (Increment 1.95).
     *
     * This whole handler used to run inside the append transaction, so every
     * read went through a role that holds almost no SELECT — and the apply
     * answered `permission denied` for the product's whole life, reaching the
     * caller as a bare 500 because `withGuard` carries no try/catch.
     * Increment 1.94 found it by giving the route a screen.
     *
     * The eligibility check and the plan are reads, so they belong here. The
     * append transaction below writes what the plan resolved and looks
     * nothing up, which is what keeps `patients` and `account_members` out of
     * the reach of the role that appends to the chain.
     */
    const exists = await withTenantTransaction(
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

    const input = {
      tenantId: ctx.access.user.tenantId,
      runId,
      actorUserId: ctx.access.user.id,
      actorName: ctx.access.user.displayName,
    };
    const plan = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => planCurveHeroImport(db, input)
    );
    const result = await withTenantAppendTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => writeCurveHeroImport(db, plan, input)
    );

    return Response.json(result, { status: 201 });
  },
  { entitlements: ["run_import"] }
);
