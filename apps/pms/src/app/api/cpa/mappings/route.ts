import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listMappings, proposeMapping } from "@/lib/cpa/mappings";

/**
 * Every chart-of-accounts mapping of the practice, proposals and decided
 * history. Each row says whether the viewer proposed it, so the page can say
 * "yours" without the session route handing out user ids. Manager rank and above.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const rows = await withTenantTransaction(user.tenantId, user.id, (db) => listMappings(db, user.tenantId));
    return Response.json({ items: rows.map((m) => ({ ...m, mine: m.proposedById === user.id })) });
  },
  { minRank: "manager" }
);

type Body = { glBucket?: string; kind?: string; reasonCode?: string; accountCode?: string; accountName?: string; side?: string; note?: string };

/**
 * Proposes a mapping (Increment 1.35). Manager rank proposes; a different
 * person approves, so the proposer is never the decider.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, (db) =>
      proposeMapping(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        glBucket: String(body.glBucket ?? ""),
        kind: String(body.kind ?? ""),
        reasonCode: body.reasonCode,
        accountCode: String(body.accountCode ?? ""),
        accountName: String(body.accountName ?? ""),
        side: String(body.side ?? ""),
        note: body.note,
      })
    );
    if (!result.ok) {
      return Response.json({ error: "The mapping was not proposed.", errors: result.errors }, { status: result.status });
    }
    return Response.json(result.mapping, { status: 201 });
  },
  { minRank: "manager" }
);
