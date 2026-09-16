import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { createCurveHeroImportRun } from "@/lib/import/runs";
import { CURVE_HERO_REPORT_KINDS, type CurveHeroReportKind } from "@pms/import";

type ImportBody = {
  reportKind?: CurveHeroReportKind;
  content?: string;
  fileName?: string;
  locationId?: string;
  businessDate?: string;
};

export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json()) as ImportBody;
    const reportKind = body.reportKind;
    if (!reportKind || !CURVE_HERO_REPORT_KINDS.includes(reportKind)) {
      return Response.json({ error: "reportKind is required and must be a Curve Hero report kind." }, { status: 400 });
    }
    const content = body.content;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return Response.json({ error: "content is required." }, { status: 400 });
    }

    const result = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      async (db) =>
        createCurveHeroImportRun(db, {
          tenantId: ctx.access.user.tenantId,
          reportKind,
          content,
          fileName: body.fileName,
          locationId: body.locationId ?? null,
          businessDate: body.businessDate ?? null,
          actorUserId: ctx.access.user.id,
          actorName: ctx.access.user.displayName,
        })
    );

    return Response.json(result, { status: result.status === "validated" ? 201 : 422 });
  },
  { entitlements: ["run_import"] }
);
