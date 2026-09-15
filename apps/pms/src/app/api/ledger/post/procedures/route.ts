import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listPatientProcedures } from "@/lib/ledger/queries";

export const GET = withGuard(
  async (req, ctx) => {
    const patientId = new URL(req.url).searchParams.get("patientId");
    if (!patientId) {
      return Response.json({ error: "patientId is required." }, { status: 400 });
    }

    const procedures = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) => listPatientProcedures(db, ctx.access.user.tenantId, patientId)
    );

    return Response.json({ procedures });
  },
  { entitlements: ["post_payments"] }
);
