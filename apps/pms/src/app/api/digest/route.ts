import { isIsoDate } from "@pms/controls-engine";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { computeDigest, digestHash, loadDigestAck, periodEnding } from "@/lib/digest/digest";
import { ATTESTABLE_CHANNELS, listMonthAttestations } from "@/lib/controls/attestations";
import { attestationCoverage, lastCompleteMonth } from "@/lib/controls/attestationCoverage";
import { readReach } from "@/lib/notices/reach";

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
    // The month that has ended, read as of today rather than as of the period:
    // the standing debt is the practice's position now, and a week the owner
    // reads in arrears does not change who has vouched for last month.
    const month = lastCompleteMonth(today);
    const { digest, ack, attestations, reach } = await withTenantTransaction(user.tenantId, user.id, async (db) => ({
      digest: await computeDigest(db, user.tenantId, period),
      ack: await loadDigestAck(db, user.tenantId, period.end),
      // Who the practice cannot reach, as of now (Increment 1.69). Beside the
      // digest for the same reason the attestation figure is, and read as of
      // today rather than as of the period: it is a position, not an event of
      // those seven days.
      reach: await readReach(db, user.tenantId),
      attestations: attestationCoverage({
        month,
        channels: ATTESTABLE_CHANNELS,
        attested: (await listMonthAttestations(db, user.tenantId, month))
          .filter((r) => r.attestation !== null)
          .map((r) => ({ channel: r.channel, seat: r.attestation!.seat as string, byName: r.attestation!.byName })),
      }),
    }));
    const summaryHash = digestHash(digest);
    return Response.json({
      digest,
      summaryHash,
      ack,
      /**
       * What nobody has vouched for, for the month that has ended (Increment 1.53).
       *
       * It rides beside the digest and never inside it. The digest states facts
       * about its seven days, the owner stamps a hash of exactly those facts, and
       * the month-end package folds the whole digest into its own hash. A standing
       * figure in there would move every closed month's hash the moment somebody
       * attested anything, and would unsettle an acknowledgment that had already
       * been given -- the false positive Increment 1.36 removed.
       */
      attestations,
      /**
       * Who the practice believes it is notifying and is not (Increment 1.69).
       *
       * Beside the digest, never inside it, for the reason above and one more:
       * the digest is also a message that leaves the product (Increment 1.64),
       * and it names nobody. This names people, so it belongs only where a
       * guard stands — on this screen and on the owner's board.
       */
      reach,
      /** True when the rows changed after the owner stamped this period. */
      changedSinceAck: ack ? ack.summaryHash !== summaryHash : false,
      computedAt: new Date().toISOString(),
    });
  },
  { minRank: "manager" }
);
