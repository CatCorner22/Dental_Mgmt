import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { decideMapping } from "@/lib/cpa/mappings";

type Body = { mappingId?: string; decision?: string };

/**
 * Approves or rejects a proposed mapping (Increment 1.35). Administrator
 * rank, and never the person who proposed it: the service refuses that.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.mappingId) return Response.json({ error: "mappingId is required." }, { status: 400 });
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return Response.json({ error: "The decision must be approved or rejected." }, { status: 400 });
    }
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, (db) =>
      decideMapping(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        mappingId: body.mappingId!,
        decision: body.decision as "approved" | "rejected",
      })
    );
    if (!result.ok) {
      return Response.json({ error: "The mapping was not decided.", errors: result.errors }, { status: result.status });
    }
    return Response.json(result.mapping);
  },
  { minRank: "admin" }
);
