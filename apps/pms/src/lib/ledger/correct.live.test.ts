import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_LEDGER } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { closeMonth, PRIOR_PERIOD_REASON } from "../cpa/close";
import { correctEntry } from "./correct";
import { approveAndPost } from "../controls/decideAndPost";
import { decideApprovalRequest, listInboxApprovals } from "../controls/approvals";

/**
 * The reversal-and-repost correction pair on the seeded Ridgeview tenant, as
 * app_rw (Increment 1.37): the pair written in one transaction, the database
 * refusing a reversal of a reversal, a second reversal of one entry, an
 * unmirrored amount, and a repost with no reversal behind it; and the closed
 * month admitting the pair while still refusing a bare labelled row; and a
 * correction above the threshold held as one request whose approval writes
 * both halves (Increment 1.38). Skipped
 * without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;

/** A month that has ended, whatever day this suite runs. */
const CLOSED_MONTH = "2026-08";
const now = new Date("2026-09-17T15:00:00Z");

describe.skipIf(!adminUrl)("Correction pair (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  /** A write-off inside the month this suite closes; the correction target. */
  let closedEntryId: string;
  /** A write-off in an open month. */
  let openEntryId: string;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as = front) {
    return withTenantTransaction(tenantId, as.id, fn, env);
  }

  /** Posts straight to the table as the administrator, past the dual-release trigger, to set the fixtures up. */
  async function insertEntry(input: {
    id: string;
    effectiveDate: string;
    postedAt: string;
    kind?: string;
    amountCents?: number;
    reasonCode?: string | null;
    reversesEntryId?: string | null;
    correctsEntryId?: string | null;
  }) {
    await db.admin.query("ALTER TABLE ledger_entries DISABLE TRIGGER ledger_entries_dual_release");
    try {
      await db.admin.query(
        `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                     effective_date, posted_at, created_by_id, created_by_name, reason_code,
                                     reverses_entry_id, corrects_entry_id, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'patient_ar', $7, $8, $9, $10, 'Riley Owner', $11, $12, $13, $14, $9)`,
        [
          input.id,
          tenantId,
          SEED_LEDGER.accountDoeId,
          SEED_LEDGER.patientJaneId,
          SEED_LEDGER.locationId,
          input.kind ?? "write_off",
          input.amountCents ?? -1000,
          input.effectiveDate,
          input.postedAt,
          owner.id,
          input.reasonCode ?? "courtesy",
          input.reversesEntryId ?? null,
          input.correctsEntryId ?? null,
          `pair-${input.id}`,
        ]
      );
    } finally {
      await db.admin.query("ALTER TABLE ledger_entries ENABLE TRIGGER ledger_entries_dual_release");
    }
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
    // The seed carries prior_period since Increment 1.39; assert it rather than inserting it,
    // because a practice that cannot name the reason cannot correct a closed month at all.
    const seeded = await db.admin.query("SELECT code FROM reason_codes WHERE tenant_id = $1 AND code = $2", [
      tenantId,
      PRIOR_PERIOD_REASON,
    ]);
    expect(seeded.rows).toHaveLength(1);
    closedEntryId = uuidv7(38_001);
    openEntryId = uuidv7(38_002);
    await insertEntry({ id: closedEntryId, effectiveDate: "2026-08-14", postedAt: "2026-08-14T15:00:00Z" });
    await insertEntry({ id: openEntryId, effectiveDate: "2026-09-10", postedAt: "2026-09-10T15:00:00Z" });
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("refuses a reversal of a reversal, a second reversal of one entry, an unmirrored amount, and an unbacked repost", async () => {
    // A reversal has to mirror the entry it clears, to the cent.
    await expect(
      insertEntry({
        id: uuidv7(38_010),
        effectiveDate: "2026-09-10",
        postedAt: now.toISOString(),
        kind: "reversal",
        amountCents: 999,
        reversesEntryId: openEntryId,
        correctsEntryId: openEntryId,
      })
    ).rejects.toThrow(/reversal_not_mirrored: a reversal of .* must be 1000, not 999/);

    // A repost posts only behind the reversal that cleared the entry.
    await expect(
      insertEntry({
        id: uuidv7(38_011),
        effectiveDate: "2026-09-10",
        postedAt: now.toISOString(),
        amountCents: -2000,
        correctsEntryId: openEntryId,
      })
    ).rejects.toThrow(/repost_without_reversal: a repost of .* posts only behind the reversal that clears it/);

    // The reversal itself goes in, and then a second one does not.
    const firstReversal = uuidv7(38_012);
    await insertEntry({
      id: firstReversal,
      effectiveDate: "2026-09-10",
      postedAt: now.toISOString(),
      kind: "reversal",
      amountCents: 1000,
      reversesEntryId: openEntryId,
      correctsEntryId: openEntryId,
    });
    await expect(
      insertEntry({
        id: uuidv7(38_013),
        effectiveDate: "2026-09-10",
        postedAt: now.toISOString(),
        kind: "reversal",
        amountCents: 1000,
        reversesEntryId: openEntryId,
        correctsEntryId: openEntryId,
      })
    ).rejects.toThrow(/already_reversed: entry .* is already reversed; correct the repost instead/);

    // A reversal names a posting, never another reversal.
    await expect(
      insertEntry({
        id: uuidv7(38_014),
        effectiveDate: "2026-09-10",
        postedAt: now.toISOString(),
        kind: "reversal",
        amountCents: -1000,
        reversesEntryId: firstReversal,
        correctsEntryId: firstReversal,
      })
    ).rejects.toThrow(/reversal_of_reversal: entry .* is itself a reversal/);

    // And a reversal that claims to correct one entry while reversing another never forms.
    await expect(
      insertEntry({
        id: uuidv7(38_015),
        effectiveDate: "2026-08-14",
        postedAt: now.toISOString(),
        kind: "reversal",
        amountCents: 1000,
        reversesEntryId: closedEntryId,
        correctsEntryId: openEntryId,
      })
    ).rejects.toThrow(/ledger_entries_reversal_corrects_its_original/);
  });

  it("writes the pair in one transaction, mirroring the entry and carrying the reason on both rows", async () => {
    const result = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: closedEntryId,
        amountCents: -2500,
        reasonCode: "courtesy",
        now,
      })
    );
    expect(result).toMatchObject({ ok: true, reasonCode: "courtesy", closedMonth: null });
    if (!result.ok) return;

    const rows = await db.admin.query(
      "SELECT id, kind, amount_cents, effective_date, posted_at, reason_code, reverses_entry_id, corrects_entry_id, memo FROM ledger_entries WHERE corrects_entry_id = $1 ORDER BY id",
      [closedEntryId]
    );
    expect(rows.rows).toHaveLength(2);
    const [reversal, repost] = rows.rows;
    expect(reversal.kind).toBe("reversal");
    expect(Number(reversal.amount_cents)).toBe(1000);
    expect(reversal.reverses_entry_id).toBe(closedEntryId);
    expect(repost.kind).toBe("write_off");
    expect(Number(repost.amount_cents)).toBe(-2500);
    expect(repost.reverses_entry_id).toBeNull();
    // Both post today against the original's effective date, so the ledger reads as history.
    for (const row of rows.rows) {
      expect(new Date(row.effective_date).toISOString().slice(0, 10)).toBe("2026-08-14");
      expect(row.posted_at.toISOString()).toBe(now.toISOString());
      expect(row.reason_code).toBe("courtesy");
      expect(row.memo).toMatch(new RegExp(`^Corrects entry ${closedEntryId} \\(courtesy\\)\\.$`));
    }

    const chain = await db.admin.query(
      "SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = 'ledger.corrected'",
      [tenantId]
    );
    expect(chain.rows).toHaveLength(1);
    expect(chain.rows[0].payload).toEqual({
      correctsEntryId: closedEntryId,
      reversalId: result.reversalId,
      repostId: result.repostId,
      reasonCode: "courtesy",
      fromCents: -1000,
      toCents: -2500,
      closedMonth: "",
    });

    // The same entry is corrected once; the repost is what a second correction names.
    const twice = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: closedEntryId,
        amountCents: -3000,
        reasonCode: "courtesy",
        now,
      })
    );
    expect(twice).toMatchObject({ ok: false, code: "already_reversed" });
  });

  it("refuses a correction of a reversal, and one that changes nothing", async () => {
    const reversalRow = await db.admin.query(
      "SELECT id FROM ledger_entries WHERE corrects_entry_id = $1 AND kind = 'reversal'",
      [closedEntryId]
    );
    const onAReversal = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: String(reversalRow.rows[0].id),
        amountCents: -500,
        reasonCode: "courtesy",
        now,
      })
    );
    expect(onAReversal).toMatchObject({ ok: false, code: "correct_a_reversal" });

    const untouchedId = uuidv7(38_050);
    await insertEntry({ id: untouchedId, effectiveDate: "2026-09-11", postedAt: "2026-09-11T15:00:00Z" });
    const unchanged = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: untouchedId,
        amountCents: -1000,
        reasonCode: "courtesy",
        now,
      })
    );
    expect(unchanged).toMatchObject({ ok: false, code: "unchanged" });
  });

  it("admits the pair into a closed month under reason prior_period, and still refuses a bare labelled row", async () => {
    // The entry this case corrects has to exist before the month closes; afterwards nothing new gets in.
    const targetId = uuidv7(38_102);
    await insertEntry({ id: targetId, effectiveDate: "2026-08-22", postedAt: "2026-08-22T15:00:00Z" });

    // Close August. Its journal lines need an approved mapping first.
    await db.admin.query(
      `INSERT INTO gl_mappings (id, tenant_id, gl_bucket, kind, reason_code, account_code, account_name, side, status,
                                proposed_by_id, proposed_by_name, proposed_at, decided_by_id, decided_by_name, decided_at)
       VALUES ($1, $2, 'patient_ar', 'write_off', '*', '6100', 'Courtesy write-offs', 'debit', 'approved',
               $3, 'Finn Front', now(), $4, 'Riley Owner', now())`,
      [uuidv7(38_100), tenantId, front.id, owner.id]
    );
    const closed = await tx((d) =>
      closeMonth(d, { tenantId, actor: { id: owner.id, name: owner.displayName }, month: CLOSED_MONTH, now })
    );
    expect(closed).toMatchObject({ ok: true });

    // A bare row labelled prior_period no longer reaches the closed month: the label is not the pair.
    await expect(
      insertEntry({
        id: uuidv7(38_101),
        effectiveDate: "2026-08-20",
        postedAt: now.toISOString(),
        kind: "adjustment",
        reasonCode: PRIOR_PERIOD_REASON,
      })
    ).rejects.toThrow(/month_closed: adjustment effective 2026-08-20 falls in 2026-08, closed to the accountant; correct the entry it replaces/);

    // The pair goes through, and both rows carry prior_period whatever reason the caller gave.
    const pair = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: targetId,
        amountCents: -4000,
        reasonCode: "courtesy",
        now,
      })
    );
    expect(pair).toMatchObject({ ok: true, reasonCode: PRIOR_PERIOD_REASON, closedMonth: CLOSED_MONTH });

    const rows = await db.admin.query(
      "SELECT kind, reason_code, memo FROM ledger_entries WHERE corrects_entry_id = $1 ORDER BY kind",
      [targetId]
    );
    expect(rows.rows.map((r) => r.kind)).toEqual(["reversal", "write_off"]);
    for (const row of rows.rows) {
      expect(row.reason_code).toBe(PRIOR_PERIOD_REASON);
      // The caller's own reason survives in the memo, beside the month that is closed.
      expect(row.memo).toMatch(/\(courtesy\); 2026-08 is closed to the accountant\.$/);
    }
  });

  it("holds a correction above the threshold as one request, and the approval writes both halves", async () => {
    // A $200 write-off is above the seeded $150 write-off threshold, so correcting it
    // needs a second person. The correction waits as one request, not two.
    const bigId = uuidv7(38_200);
    await insertEntry({ id: bigId, effectiveDate: "2026-09-12", postedAt: "2026-09-12T15:00:00Z", amountCents: -20_000 });

    const held = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: bigId,
        amountCents: -15_000,
        reasonCode: "courtesy",
        now,
      })
    );
    expect(held).toMatchObject({ ok: false, code: "needs_second" });
    if (held.ok || held.code !== "needs_second") return;
    expect(held.why).toMatch(/approving it writes both the reversal and the repost/);

    // Nothing posted yet: a hold is a hold.
    const beforeRelease = await db.admin.query("SELECT count(*)::int AS n FROM ledger_entries WHERE corrects_entry_id = $1", [bigId]);
    expect(beforeRelease.rows[0].n).toBe(0);

    // The request names the entry, and the larger of the two figures.
    const request = await db.admin.query("SELECT amount_cents, corrects_entry_id, channel, status FROM approval_requests WHERE id = $1", [
      held.approvalRequestId,
    ]);
    expect(request.rows[0]).toMatchObject({ corrects_entry_id: bigId, channel: "writeoff", status: "pending" });
    expect(Number(request.rows[0].amount_cents)).toBe(20_000);

    // The owner approves. One decision, both halves.
    const released = await approveAndPost(tenantId, { id: owner.id, name: owner.displayName }, held.approvalRequestId, env);
    expect(released).toMatchObject({ ok: true });

    const rows = await db.admin.query(
      "SELECT kind, amount_cents, approval_request_id, corrects_entry_id, reverses_entry_id FROM ledger_entries WHERE corrects_entry_id = $1 ORDER BY kind",
      [bigId]
    );
    expect(rows.rows).toHaveLength(2);
    const [repost, reversal] = rows.rows.at(0)!.kind === "reversal" ? [rows.rows[1], rows.rows[0]] : rows.rows;
    expect(reversal.kind).toBe("reversal");
    expect(Number(reversal.amount_cents)).toBe(20_000);
    expect(reversal.reverses_entry_id).toBe(bigId);
    expect(repost.kind).toBe("write_off");
    expect(Number(repost.amount_cents)).toBe(-15_000);
    // Both cite the one approval: the second person released the correction, not a row.
    expect(reversal.approval_request_id).toBe(held.approvalRequestId);
    expect(repost.approval_request_id).toBe(held.approvalRequestId);
  });

  it("shows the waiting correction to the second person as a correction, with both figures", async () => {
    // A $300 write-off, above the threshold: held, and the owner's inbox has to say what it is.
    const bigId = uuidv7(39_001);
    await insertEntry({ id: bigId, effectiveDate: "2026-09-13", postedAt: "2026-09-13T15:00:00Z", amountCents: -30_000 });
    const held = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: bigId,
        amountCents: -18_000,
        reasonCode: "courtesy",
        now,
      })
    );
    expect(held).toMatchObject({ ok: false, code: "needs_second" });
    if (held.ok || held.code !== "needs_second") return;

    // The inbox carries the whole correction: the entry it replaces, the figure now, the figure proposed.
    const inbox = await tx((d) => listInboxApprovals(d, tenantId, owner.id), owner);
    const item = inbox.find((r) => r.id === held.approvalRequestId);
    expect(item).toBeDefined();
    expect(item!.correctsEntryId).toBe(bigId);
    expect(item!.heldPayload.kind).toBe("reversal");
    // The reversal mirrors the entry, so the entry's own figure is the reversal's opposite.
    expect(-item!.heldPayload.amountCents).toBe(-30_000);
    expect(item!.heldPayload.correction).toMatchObject({
      correctsEntryId: bigId,
      repostKind: "write_off",
      repostAmountCents: -18_000,
    });

    // Declining writes neither half: a correction the second person refused leaves the ledger alone.
    const declined = await tx(
      (d) =>
        decideApprovalRequest(d, {
          tenantId,
          requestId: held.approvalRequestId,
          approverId: owner.id,
          approverName: owner.displayName,
          decision: "declined",
          reason: "The original figure is right; bill the patient.",
        }),
      owner
    );
    expect(declined.ok).toBe(true);
    const after = await db.admin.query("SELECT count(*)::int AS n FROM ledger_entries WHERE corrects_entry_id = $1", [bigId]);
    expect(after.rows[0].n).toBe(0);
    // And the entry is still correctable: a refused correction is not a spent one.
    const second = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: bigId,
        amountCents: -20_000,
        reasonCode: "courtesy",
        now,
      })
    );
    expect(second).toMatchObject({ ok: false, code: "needs_second" });
  });

  it("refuses a reason code this practice has not adopted, in words rather than as a failed insert", async () => {
    const targetId = uuidv7(39_100);
    await insertEntry({ id: targetId, effectiveDate: "2026-09-14", postedAt: "2026-09-14T15:00:00Z" });
    const refused = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: targetId,
        amountCents: -2000,
        reasonCode: "wrong figure keyed",
        now,
      })
    );
    // `ledger_entries.reason_code` is a foreign key; free text used to reach the database and fail
    // the insert, which the browser saw as a 500. The service answers it now.
    expect(refused).toMatchObject({ ok: false, code: "unknown_reason" });
    if (refused.ok || refused.code !== "unknown_reason") return;
    expect(refused.why).toMatch(/This practice has no reason code "wrong figure keyed"/);
    const after = await db.admin.query("SELECT count(*)::int AS n FROM ledger_entries WHERE corrects_entry_id = $1", [targetId]);
    expect(after.rows[0].n).toBe(0);

    // The same correction with a reason the practice has adopted goes through.
    const ok = await tx((d) =>
      correctEntry(d, {
        tenantId,
        actorId: front.id,
        actorName: front.displayName,
        entryId: targetId,
        amountCents: -2000,
        reasonCode: "courtesy",
        now,
      })
    );
    expect(ok).toMatchObject({ ok: true });
  });
});
