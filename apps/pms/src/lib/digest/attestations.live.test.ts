import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { attestChannelMonth } from "../controls/attestations";
import { attestChannelRelease } from "../controls/release";
import { lastCompleteMonth } from "../controls/attestationCoverage";
import { computeMonthPackage, packageHash } from "../cpa/package";
import { computeDigest, digestHash, periodEnding } from "./digest";

/**
 * What the weekly digest may say about attestations (Increment 1.53).
 *
 * The digest states its seven days and nothing else, because the owner stamps a
 * hash of exactly those figures and the month-end package folds the whole digest
 * into its own hash. So an attestation made this week is a count here; what the
 * practice still owes for the month that has ended is not, and rides beside the
 * digest on the route instead. These cases hold that line from real rows.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const accountant = DEV_USERS.find((u) => u.username === "ridgeview-cpa")!;
const today = new Date().toISOString().slice(0, 10);
const period = periodEnding(today);
const endedMonth = lastCompleteMonth(today);

describe.skipIf(!adminUrl)("the digest's attestation count (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("counts nothing before anybody attests, and lists the kind nowhere else", async () => {
    const digest = await tx((d) => computeDigest(d, tenantId, period));
    expect(digest.alerts.channelsAttested).toBe(0);
    // The kind is consumed by a named field now, so it must not also appear
    // under the chain's other kinds: one event counted twice reads as two.
    expect(digest.chain.otherKinds.map((k) => k.key)).not.toContain("control.channel_attested");
  });

  it("counts the attestation in the week it was made, and moves the hash the owner stamps", async () => {
    const before = await tx((d) => computeDigest(d, tenantId, period));

    const made = await tx((d) =>
      attestChannelMonth(d, {
        tenantId,
        actor: { id: accountant.id, name: accountant.displayName },
        seat: "accountant",
        month: endedMonth,
        channel: "payroll",
        note: "Tied the payroll register to the provider's report and to the bank debits for the month.",
      })
    );
    expect(made.ok).toBe(true);

    const after = await tx((d) => computeDigest(d, tenantId, period));
    expect(after.alerts.channelsAttested).toBe(before.alerts.channelsAttested + 1);
    expect(after.chain.otherKinds.map((k) => k.key)).not.toContain("control.channel_attested");
    // A figure the owner reads has to move the hash they stamp, or the stamp
    // would say they read something they did not.
    expect(digestHash(after)).not.toBe(digestHash(before));
  });

  it("counts the act in the month it happened, never in the month it speaks for", async () => {
    // The attestation above was made today, about the month that has ended. The
    // package for the month it speaks for must not count the act, because the act
    // is not one of that month's events; its own tie-out is what reports it.
    const ended = await tx((d) => computeMonthPackage(d, tenantId, endedMonth));
    expect(ended.counts.alerts.channelsAttested).toBe(0);
    // And its tie-out still reports the channel nobody has spoken for rather than
    // naming who covered the other one: a month half vouched for is not vouched
    // for, and the sentence says the part that is still missing.
    const tieOut = ended.tieOut.find((t) => t.key === "external_channels_attested")!;
    expect(tieOut.holds).toBe(false);
    expect(tieOut.detail).toBe(
      `Nobody has reviewed new vendors for ${endedMonth}, so that channel is a month the product cannot speak for and no person has.`
    );

    const thisMonth = await tx((d) => computeMonthPackage(d, tenantId, today.slice(0, 7)));
    expect(thisMonth.counts.alerts.channelsAttested).toBe(1);
  });

  it("leaves the month it speaks for hashing the same whoever attests next", async () => {
    // The standing debt is deliberately absent from the digest, so attesting the
    // other channel today cannot move the hash of a month whose own figures have
    // not changed -- the false positive Increment 1.36 removed, in a new place.
    const before = packageHash(await tx((d) => computeMonthPackage(d, tenantId, "2020-01")));

    const other = await tx((d) =>
      attestChannelMonth(d, {
        tenantId,
        actor: { id: owner.id, name: owner.displayName },
        seat: "practice",
        month: endedMonth,
        channel: "vendor_new",
        note: "Checked every vendor opened in the ended month against the approval emails.",
      })
    );
    expect(other.ok).toBe(true);

    expect(packageHash(await tx((d) => computeMonthPackage(d, tenantId, "2020-01")))).toBe(before);
  });
  /**
   * Increment 1.100. `control.release_attested` sat in
   * `EVENT_KINDS_SHOWN_ELSEWHERE`, so the week's reader saw these only inside
   * the total on the chain line — and the "elsewhere" they were held for was
   * the month-end package, which until Increment 1.97 showed a bare count per
   * channel and is in any case a month away.
   *
   * `needingSecond` is what the practice still owes evidence for, matching the
   * package's `requiredSecond` so the two readers cannot disagree.
   */
  it("counts the week's releases on a channel the ledger does not carry, and how many needed a second", async () => {
    const before = await tx((d) => computeDigest(d, tenantId, period));

    const first = await tx((d) =>
      attestChannelRelease(d, { tenantId, actor: { id: owner.id, name: owner.displayName }, channel: "payroll", amountUsd: 18_000 })
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.evaluation.dualRequired).toBe(true);

    const after = await tx((d) => computeDigest(d, tenantId, period));
    expect(after.alerts.releasesAttested).toBe(before.alerts.releasesAttested + 1);
    expect(after.alerts.releasesNeedingSecond).toBe(before.alerts.releasesNeedingSecond + 1);

    // And it no longer hides among the chain's other kinds, which is where a
    // reader would look for it and not find it.
    expect(after.chain.otherKinds.some((k) => k.key === "control.release_attested")).toBe(false);
  });

});
