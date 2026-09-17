import { isIsoDate } from "@pms/controls-engine";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { computeDigest, digestHash, loadDigestAck, periodEnding } from "@/lib/digest/digest";

/**
 * The weekly digest: seven days ending on `ending` (default today), computed
 * from rows on every read, with the acknowledgment for that period if one
 * exists. Manager rank and above; the counts are the practice's and name
 * no one.
 */
export const GET = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const today = new Date().toISOString().slice(0, 10);
    const ending = new URL(req.url).searchParams.get("ending") ?? today;
    if (!isIsoDate(ending)) {
      return Response.json({ error: "The period end must be a calendar date (YYYY-MM-DD)." }, { status: 400 });
    }
    if (ending > today) {
      return Response.json({ error: "The digest reads rows that exist; a week that has not ended has none yet." }, { status: 400 });
    }
    const period = periodEnding(ending);
    const { digest, ack } = await withTenantTransaction(user.tenantId, user.id, async (db) => ({
      digest: await computeDigest(db, user.tenantId, period),
      ack: await loadDigestAck(db, user.tenantId, period.end),
    }));
    const summaryHash = digestHash(digest);
    return Response.json({
      digest,
      summaryHash,
      ack,
      /** True when the rows changed after the owner stamped this period. */
      changedSinceAck: ack ? ack.summaryHash !== summaryHash : false,
      computedAt: new Date().toISOString(),
    });
  },
  { minRank: "manager" }
);
