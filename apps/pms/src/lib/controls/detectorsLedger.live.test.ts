import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_BANK, SEED_LEDGER } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { HARD_EVENT_KINDS, listHardEvents } from "../alerts/hardEvents";
import { appendControlEvent } from "./events";
import {
  BACKDATED_POSTING_KIND,
  DUPLICATE_PAYMENT_KIND,
  listControlFindings,
  refreshLedgerFindings,
  RELEASE_WITHOUT_APPROVAL_KIND,
} from "./detectors";

/**
 * The ledger detectors on the seeded Ridgeview tenant, as app_rw. The
 * dual-release trigger is switched off for one administrator insert to
 * plant the row that should be impossible; the detector alarms on it and
 * ignores an approved one. A write-off posted 71 days after its effective
 * date and the later of two same-day payments are flagged, and a reversal
 * clears the duplicate. Skipped without PMS_TEST_POSTGRES_URL; mandatory
 * under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const now = new Date("2026-09-17T15:00:00Z");

describe.skipIf(!adminUrl)("Ledger detectors (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  const ids = {
    unapproved: uuidv7(34_001),
    approved: uuidv7(34_002),
    backdated: uuidv7(34_003),
    pay1: uuidv7(34_004),
    pay2: uuidv7(34_005),
    reversal: uuidv7(34_006),
  };

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  async function insertEntry(input: {
    id: string;
    kind: string;
    amountCents: number;
    effectiveDate: string;
    postedAt: string;
    approvalRequestId?: string | null;
    reversesEntryId?: string | null;
    disableTrigger?: boolean;
  }) {
    if (input.disableTrigger) await db.admin.query("ALTER TABLE ledger_entries DISABLE TRIGGER ledger_entries_dual_release");
    try {
      await db.admin.query(
        `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                     effective_date, posted_at, created_by_id, created_by_name, approval_request_id,
                                     reverses_entry_id, reason_code, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'patient_ar', $7, $8, $9, $10, 'Riley Owner', $11, $12, $13, $14, $9)`,
        [
          input.id,
          tenantId,
          SEED_LEDGER.accountDoeId,
          SEED_LEDGER.patientJaneId,
          SEED_LEDGER.locationId,
          input.kind,
          input.amountCents,
          input.effectiveDate,
          input.postedAt,
          owner.id,
          input.approvalRequestId ?? null,
          input.reversesEntryId ?? null,
          input.kind === "write_off" ? "courtesy" : input.kind === "reversal" ? "correction" : input.kind === "refund" ? "overpayment" : null,
          `dt-${input.id}`,
        ]
      );
    } finally {
      if (input.disableTrigger) await db.admin.query("ALTER TABLE ledger_entries ENABLE TRIGGER ledger_entries_dual_release");
    }
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = {
      POSTGRES_URL: await db.loginAs("app_rw"),
      APPEND_ROLE_DSN: await db.loginAs("app_append"),
      BCRYPT_COST: "4",
    };
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("records nothing on the seeded ledger", async () => {
    const summaries = await tx((d) => refreshLedgerFindings(d, tenantId, now));
    expect(summaries.map((s) => [s.kind, s.open])).toEqual([
      [RELEASE_WITHOUT_APPROVAL_KIND, 0],
      [BACKDATED_POSTING_KIND, 0],
      [DUPLICATE_PAYMENT_KIND, 0],
    ]);
  });

  it("alarms on a guarded release the trigger should have refused, and not on an approved one", async () => {
    // $500 write-off, threshold $150, nothing cited: only possible with the trigger off.
    await insertEntry({ id: ids.unapproved, kind: "write_off", amountCents: -50_000, effectiveDate: "2026-09-16", postedAt: "2026-09-16T20:00:00Z", disableTrigger: true });
    // The trigger refuses the same row with the trigger on.
    await expect(
      insertEntry({ id: uuidv7(34_099), kind: "write_off", amountCents: -50_000, effectiveDate: "2026-09-16", postedAt: "2026-09-16T20:01:00Z" })
    ).rejects.toThrow();
    // An approved release cites its request and is not an alarm. Approve the seeded pending request first.
    const { rows } = await db.admin.query("SELECT id FROM approval_requests WHERE tenant_id = $1 AND status = 'pending' LIMIT 1", [tenantId]);
    const requestId = String(rows[0].id);
    await db.admin.query(
      "UPDATE approval_requests SET status = 'approved', second_approver_id = $2, second_approver_name = 'Riley Owner', decided_at = now() WHERE id = $1",
      [requestId, owner.id]
    );
    await insertEntry({ id: ids.approved, kind: "write_off", amountCents: -7_500, effectiveDate: "2026-09-16", postedAt: "2026-09-16T20:02:00Z", approvalRequestId: requestId, disableTrigger: true });

    const summaries = await tx((d) => refreshLedgerFindings(d, tenantId, now));
    expect(summaries[0]).toMatchObject({ kind: RELEASE_WITHOUT_APPROVAL_KIND, inserted: 1, open: 1 });
    const alarm = (await tx((d) => listControlFindings(d, tenantId))).find((r) => r.kind === RELEASE_WITHOUT_APPROVAL_KIND);
    expect(alarm).toMatchObject({ subjectKind: "ledger_entry", subjectId: ids.unapproved, severity: "high", status: "open" });
    expect((alarm!.detail as { sentence: string }).sentence).toMatch(
      /^A \$500\.00 write-off posted 2026-09-16 cites neither an approved request nor a policy exception, and the active policy holds the writeoff channel to dual release above \$150\.00\./
    );
    expect(JSON.stringify(alarm!.detail)).not.toMatch(/Riley|Finn/);
  });

  it("flags a write-off posted long after its effective date, graded by the gap", async () => {
    await insertEntry({ id: ids.backdated, kind: "write_off", amountCents: -1_000, effectiveDate: "2026-07-01", postedAt: "2026-09-10T16:00:00Z" });
    const summaries = await tx((d) => refreshLedgerFindings(d, tenantId, now));
    expect(summaries[1]).toMatchObject({ kind: BACKDATED_POSTING_KIND, inserted: 1, open: 1 });
    const row = (await tx((d) => listControlFindings(d, tenantId))).find((r) => r.kind === BACKDATED_POSTING_KIND);
    expect(row).toMatchObject({ subjectId: ids.backdated, severity: "high" });
    expect((row!.detail as { daysBack: number; sentence: string }).daysBack).toBe(71);
    expect((row!.detail as { sentence: string }).sentence).toBe("A $10.00 write-off effective 2026-07-01 was posted on 2026-09-10, 71 days after its effective date.");
  });

  it("flags the later of two same-day payments and closes the finding once one is reversed", async () => {
    await insertEntry({ id: ids.pay1, kind: "patient_payment", amountCents: -2_500, effectiveDate: "2026-09-15", postedAt: "2026-09-15T14:00:00Z" });
    await insertEntry({ id: ids.pay2, kind: "patient_payment", amountCents: -2_500, effectiveDate: "2026-09-15", postedAt: "2026-09-15T14:05:00Z" });
    let summaries = await tx((d) => refreshLedgerFindings(d, tenantId, now));
    expect(summaries[2]).toMatchObject({ kind: DUPLICATE_PAYMENT_KIND, inserted: 1, open: 1 });
    const dup = (await tx((d) => listControlFindings(d, tenantId))).find((r) => r.kind === DUPLICATE_PAYMENT_KIND);
    expect(dup).toMatchObject({ subjectId: ids.pay2, severity: "low", status: "open" });
    expect((dup!.detail as { firstEntryId: string; count: number }).firstEntryId).toBe(ids.pay1);

    // A reversal of the second payment resolves it: the reversal mirrors the amount and reverses the entry.
    await insertEntry({ id: ids.reversal, kind: "reversal", amountCents: 2_500, effectiveDate: "2026-09-16", postedAt: "2026-09-16T09:00:00Z", reversesEntryId: ids.pay2 });
    summaries = await tx((d) => refreshLedgerFindings(d, tenantId, now));
    expect(summaries[2]).toMatchObject({ closed: 1, open: 0 });
    const closed = (await tx((d) => listControlFindings(d, tenantId))).find((r) => r.subjectId === ids.pay2);
    expect(closed).toMatchObject({ status: "closed", closedReason: "reversed or outside the 45-day window" });
    // The alarm and the backdated finding still stand: the rows they describe cannot change.
    const open = (await tx((d) => listControlFindings(d, tenantId))).filter((r) => r.status === "open");
    expect(open.map((r) => r.kind).sort()).toEqual([BACKDATED_POSTING_KIND, RELEASE_WITHOUT_APPROVAL_KIND]);
  });

  it("reads all six hard events from rows for the owner, immediately and without a name", async () => {
    const since = new Date("2026-09-10T15:00:00Z");
    // A refund needs a reason code; the seed carries none for refunds yet.
    await db.admin.query("INSERT INTO reason_codes (tenant_id, code, kind, label) VALUES ($1, 'overpayment', 'refund', 'Patient overpayment') ON CONFLICT DO NOTHING", [tenantId]);
    // After hours: 02:30 UTC on the 16th is 21:30 on Tuesday the 15th at Main (Chicago), which closes at 19:00.
    await insertEntry({ id: uuidv7(34_010), kind: "refund", amountCents: 12_000, effectiveDate: "2026-09-15", postedAt: "2026-09-16T02:30:00Z" });
    // In hours: the same refund at 10:00 Chicago does not page.
    await insertEntry({ id: uuidv7(34_011), kind: "refund", amountCents: 3_000, effectiveDate: "2026-09-16", postedAt: "2026-09-16T15:00:00Z" });
    // A bank run whose variance is over the threshold, and one under it.
    for (const [id, variance] of [
      [uuidv7(34_020), 25_000],
      [uuidv7(34_021), 4_000],
    ] as const) {
      await db.admin.query(
        `INSERT INTO reconciliation_runs (id, tenant_id, bank_account_id, source, period_start, period_end, status, summary,
                                          bank_net_cents, matched_cents, variance_cents, created_at, created_by_id, created_by_name)
         VALUES ($1, $2, $3, 'statement_import', '2026-09-14', '2026-09-15', 'variance', '{}', 100000, $4, $5, '2026-09-16T12:00:00Z', $6, 'Riley Owner')`,
        [id, tenantId, SEED_BANK.accountId, 100000 - variance, variance, owner.id]
      );
    }
    // The nightly verifier said no once.
    await db.admin.query(
      `INSERT INTO audit_chain_checks (tenant_id, day, ok, head_hash, event_count, checked_at) VALUES ($1, '2026-09-16', false, 'deadbeef', 41, '2026-09-16T04:00:00Z')`,
      [tenantId]
    );
    // The owner holds approve_writeoffs (weight 5): a signature seen in August is known; a new one in the window pages.
    // uuidv7 takes a millisecond stamp and adds randomness, so the ids are captured once and reused.
    const sessionIds = { known: uuidv7(34_030), repeat: uuidv7(34_031), phone: uuidv7(34_032) };
    for (const [id, ua, at] of [
      [sessionIds.known, "Mozilla/5.0 (desk)", "2026-08-01T10:00:00Z"],
      [sessionIds.repeat, "Mozilla/5.0 (desk)", "2026-09-16T10:00:00Z"],
      [sessionIds.phone, "Mozilla/5.0 (phone)", "2026-09-16T13:00:00Z"],
    ] as const) {
      await db.admin.query(
        `INSERT INTO sessions (id, tenant_id, user_id, created_at, last_seen_at, absolute_expires_at, idle_expires_at, device_profile, user_agent)
         VALUES ($1, $2, $3, $4, $4, $4::timestamptz + interval '12 hours', $4::timestamptz + interval '30 minutes', 'desk', $5)`,
        [id, tenantId, owner.id, at, ua]
      );
    }
    // A dual-control waiver on the chain.
    await tx((d) =>
      appendControlEvent(
        d,
        tenantId,
        owner.id,
        "control.policy_changed",
        { version: 2, change: "exception_added", exceptionId: "ex-vacation-cover", action: "waive_dual", channels: ["writeoff"], effectiveTo: "2026-09-30" },
        new Date("2026-09-16T15:30:00Z")
      )
    );

    const events = await tx((d) => listHardEvents(d, tenantId, { since, now }));
    const byKind = new Map(events.map((e) => [e.kind, e]));
    expect([...byKind.keys()].sort()).toEqual([...HARD_EVENT_KINDS].sort());
    expect(events.filter((e) => e.kind === "after_hours_refund")).toHaveLength(1);
    expect(byKind.get("after_hours_refund")!.sentence).toBe(
      "A $120.00 refund was posted on Tuesday 2026-09-15 at 21:30 local time; Main is open 07:00 to 19:00 that day."
    );
    // The write-off posted 71 days after its effective date on the 10th is inside the window. The seed posts its
    // back-dated history at seed time, so those rows page too; that is the rule working, not noise.
    const retro = events.filter((e) => e.kind === "retroactive_entry");
    expect(retro.map((e) => e.subjectId), "retroactive entries").toContain(ids.backdated);
    expect(retro.find((e) => e.subjectId === ids.backdated)!.sentence).toBe(
      "A $10.00 write-off effective 2026-07-01 was posted on 2026-09-10, 71 days after its effective date."
    );
    expect(events.filter((e) => e.kind === "new_device_financial_role").map((e) => e.subjectId), "new devices").toEqual([sessionIds.phone]);
    expect(events.filter((e) => e.kind === "deposit_variance")).toHaveLength(1);
    expect(byKind.get("deposit_variance")!.sentence).toMatch(/carries a \$250\.00 variance against the practice's deposits, over the \$100\.00 threshold/);
    expect(byKind.get("deposit_variance")!.href).toMatch(/^\/reconciliation\//);
    expect(byKind.get("chain_failure")!.sentence).toMatch(/^The chain check for 2026-09-16 failed: 41 events did not verify/);
    expect(byKind.get("new_device_financial_role")!.sentence).toMatch(/^A holder of Approve write-offs \/ adjustments and Reconcile bank to PMS signed in from a browser not seen before/);
    expect(byKind.get("waived_dual_control")!.sentence).toBe("Dual control was waived on the writeoff channel until 2026-09-30. A waiver never outlives 90 days.");
    // Newest first, and no person anywhere.
    expect(events.map((e) => e.at)).toEqual([...events.map((e) => e.at)].sort().reverse());
    expect(JSON.stringify(events)).not.toMatch(/Riley|Finn|Owner Riley/);
  });
});
