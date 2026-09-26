import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { buildOwnerBoard } from "../home/board";
import { computeMonthPackage } from "../cpa/package";
import { attestChannelMonth } from "./attestations";
import { lastCompleteMonth } from "./attestationCoverage";

/**
 * One coverage, two surfaces (Increment 1.52).
 *
 * The month-end package's tie-out and the owner board's card both answer the
 * same question — who vouched for the channels this build cannot enforce —
 * and they must answer it in the same words from the same rows. A tie-out that
 * reads green while the board reads red is worse than either alone, because
 * the reader then has to decide which one lies. So the assertion here is
 * equality between them at each of three states: nobody, one of two, both.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const accountant = DEV_USERS.find((u) => u.username === "ridgeview-cpa")!;
// Both surfaces read the month that has ended, never the one still filling.
const month = lastCompleteMonth(new Date().toISOString().slice(0, 10));

describe.skipIf(!adminUrl)("what nobody vouched for, on both surfaces (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  /** The tie-out row and the board card, read from the same rows in one pass. */
  async function bothSurfaces() {
    return tx(async (d) => {
      const pkg = await computeMonthPackage(d, tenantId, month);
      const board = await buildOwnerBoard(d, tenantId, owner.id);
      return { tieOut: pkg.tieOut.find((t) => t.key === "external_channels_attested")!, card: board.attestations };
    });
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

  it("names both channels when nobody has spoken for either", async () => {
    const { tieOut, card } = await bothSurfaces();

    expect(card.month).toBe(month);
    expect(card.channels).toEqual(["vendor_new", "payroll"]);
    expect(card.attested).toEqual([]);
    expect(card.unattested).toEqual(["vendor_new", "payroll"]);
    expect(card.complete).toBe(false);
    expect(card.sentence).toBe(
      `Nobody has reviewed new vendors and payroll for ${month}, so those channels are a month the product cannot speak for and no person has.`
    );

    // The tie-out says it in the card's words rather than its own.
    expect(tieOut.holds).toBe(false);
    expect(tieOut.detail).toBe(card.sentence);
  });

  it("still fails, naming only the channel left, once the accountant attests one", async () => {
    const made = await tx((d) =>
      attestChannelMonth(d, {
        tenantId,
        actor: { id: accountant.id, name: accountant.displayName },
        seat: "accountant",
        month,
        channel: "payroll",
        note: "Tied the payroll register to the provider's report and to the bank debits for the month.",
      })
    );
    expect(made.ok).toBe(true);

    const { tieOut, card } = await bothSurfaces();
    expect(card.attested).toEqual(["payroll"]);
    expect(card.unattested).toEqual(["vendor_new"]);
    expect(card.complete).toBe(false);
    // One channel left reads as one, not as "channels are".
    expect(card.sentence).toBe(
      `Nobody has reviewed new vendors for ${month}, so that channel is a month the product cannot speak for and no person has.`
    );
    expect(tieOut.holds).toBe(false);
    expect(tieOut.detail).toBe(card.sentence);
  });

  it("holds, naming who and marking the practice's own word, once both carry an attestation", async () => {
    const made = await tx((d) =>
      attestChannelMonth(d, {
        tenantId,
        actor: { id: owner.id, name: owner.displayName },
        seat: "practice",
        month,
        channel: "vendor_new",
        note: "Checked every new vendor this month against the approval emails that opened them.",
      })
    );
    expect(made.ok).toBe(true);

    const { tieOut, card } = await bothSurfaces();
    expect(card.unattested).toEqual([]);
    expect(card.complete).toBe(true);
    // The practice vouching for itself is still an attestation, and still
    // marked as the practice's own word rather than an outside reading.
    expect(card.sentence).toContain(`payroll by ${accountant.displayName}`);
    expect(card.sentence).toContain(`new vendors by ${owner.displayName} (the practice itself)`);
    expect(card.sentence).not.toContain(`${accountant.displayName} (the practice itself)`);
    expect(tieOut.holds).toBe(true);
    expect(tieOut.detail).toBe(card.sentence);
  });
});
