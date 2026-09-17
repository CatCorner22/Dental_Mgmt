import { DECISION_KIND_LABEL, isReviewAction, KEEP_DAYS, TIGHTEN_DAYS } from "@pms/controls-engine";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { reviewDecision } from "@/lib/controls/decisions";

type Body = { decisionId?: string; action?: string; note?: string };

/**
 * Reviews a decision that has come due: keep (the same decision, another
 * 90 days), tighten (remediate for 30 days, with a note), or retire (ends
 * it, with a note). One superseding row per review; nothing renews on its
 * own. Administrator rank, like recording a decision.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = String(body.action ?? "");
    if (!isReviewAction(action)) {
      return Response.json({ error: "The review was not recorded.", errors: ["Review action must be keep, tighten, or retire."] }, { status: 400 });
    }
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      reviewDecision(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        decisionId: String(body.decisionId ?? ""),
        action,
        note: body.note == null ? undefined : String(body.note),
      })
    );
    if (!result.ok) {
      return Response.json({ error: "The review was not recorded.", errors: result.errors }, { status: result.status ?? 400 });
    }
    const d = result.decision;
    const sentence =
      action === "keep"
        ? `Kept: ${DECISION_KIND_LABEL[d.kind]} stands and comes up for review again on ${d.reviewBy} (${KEEP_DAYS} days).`
        : action === "tighten"
          ? `Tightened: the decision is now Remediate, reviewed again on ${d.reviewBy} (${TIGHTEN_DAYS} days). It licenses nothing.`
          : "Retired: the decision no longer stands and nothing replaces it. The subject reads as undecided again.";
    return Response.json({ action, decision: d, sentence }, { status: 201 });
  },
  { minRank: "admin" }
);
