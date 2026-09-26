import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { recordRehashBaseline } from "@/lib/cpa/rehash";

type Body = { month?: string };

/**
 * Takes the baseline for a month closed under an older package shape
 * (Increment 1.56): one append-only row saying what the month hashes to under
 * the shape in force now, and one chain event.
 *
 * Administrator rank, like the close itself. It records nothing about the past
 * and rewrites nothing: the close's own frozen hash still says what the
 * accountant received. What it changes is what a later reader may conclude,
 * and from which date, so it is the practice's act rather than a background job.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, (db) =>
      recordRehashBaseline(db, { tenantId: user.tenantId, actor: { id: user.id, name: user.displayName }, month: String(body.month ?? "") })
    );
    if (!result.ok) {
      return Response.json({ error: result.code, verb: result.verb, why: result.why }, { status: result.status });
    }
    return Response.json({ ok: true, baseline: result.baseline }, { status: 201 });
  },
  { minRank: "admin" }
);
