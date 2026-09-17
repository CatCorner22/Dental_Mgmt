import { overdueReviews } from "@pms/controls-engine";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { listDecisions, recordDecision } from "@/lib/controls/decisions";

type Body = {
  subjectKind?: string;
  subjectId?: string;
  kind?: string;
  note?: string;
  reviewBy?: string;
  residualAtDecision?: number;
  supersedesDecisionId?: string;
};

/** The append-only control register, with overdue reviews called out. */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const decisions = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      listDecisions(db, user.tenantId)
    );
    const asOf = new Date().toISOString().slice(0, 10);
    return Response.json({
      asOf,
      items: decisions,
      overdue: overdueReviews(decisions, asOf).map((d) => d.id),
    });
  },
  { minRank: "manager" }
);

/** Records one decision. The note must say why; a review date must be in the future. */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      recordDecision(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        subjectKind: String(body.subjectKind ?? ""),
        subjectId: String(body.subjectId ?? ""),
        kind: String(body.kind ?? ""),
        note: String(body.note ?? ""),
        reviewBy: body.reviewBy ? String(body.reviewBy) : undefined,
        residualAtDecision: typeof body.residualAtDecision === "number" ? body.residualAtDecision : undefined,
        supersedesDecisionId: body.supersedesDecisionId ? String(body.supersedesDecisionId) : undefined,
      })
    );
    if (!result.ok) {
      // A refusal of the actor (self-licensing) is 403; malformed input is 400.
      return Response.json({ error: "The decision was not recorded.", errors: result.errors }, { status: result.status ?? 400 });
    }
    return Response.json(result.decision, { status: 201 });
  },
  { minRank: "admin" }
);
