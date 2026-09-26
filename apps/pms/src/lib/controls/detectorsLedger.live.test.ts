import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_BANK, SEED_LEDGER, SEED_STORY_WEEK } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { AFTER_HOURS_HOLD_EXCEPTION, addDays, evaluateRelease } from "@pms/controls-engine";
import type { PostEntryInput } from "@pms/ledger";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { HARD_EVENT_KINDS, listHardEvents } from "../alerts/hardEvents";
import { afterHoursFactsFor, postLedgerEntry } from "../ledger/post";
import { createApprovalRequest } from "./approvals";
import { restoreException, retireException } from "./exceptions";
import { approveAndPost } from "./decideAndPost";
import { appendControlEvent } from "./events";
import { loadActivePolicy } from "./policy";
import { loadStaff } from "./staff";
import {
  BACKDATED_POSTING_KIND,
  DUPLICATE_PAYMENT_KIND,
  listControlFindings,
  refreshLedgerFindings,
  RELEASE_WITHOUT_APPROVAL_KIND,
  SEALED_DAY_POSTING_KIND,
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
  // uuidv7 adds randomness to the same stamp, so the sealed-day ids are captured once.
  const sealedIds = { first: uuidv7(34_041), late: uuidv7(34_051), second: uuidv7(34_052) };

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
      [SEALED_DAY_POSTING_KIND, 0],
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
    // Posted at 10:00 Chicago: inside hours, so the after-hours hold (Increment 1.30) leaves it alone.
    await insertEntry({ id: ids.reversal, kind: "reversal", amountCents: 2_500, effectiveDate: "2026-09-16", postedAt: "2026-09-16T15:00:00Z", reversesEntryId: ids.pay2 });
    summaries = await tx((d) => refreshLedgerFindings(d, tenantId, now));
    expect(summaries[2]).toMatchObject({ closed: 1, open: 0 });
    const closed = (await tx((d) => listControlFindings(d, tenantId))).find((r) => r.subjectId === ids.pay2);
    expect(closed).toMatchObject({ status: "closed", closedReason: "reversed or outside the 45-day window" });
    // The alarm and the backdated finding still stand: the rows they describe cannot change.
    const open = (await tx((d) => listControlFindings(d, tenantId))).filter((r) => r.status === "open");
    expect(open.map((r) => r.kind).sort()).toEqual([BACKDATED_POSTING_KIND, RELEASE_WITHOUT_APPROVAL_KIND]);
  });

  it("reads all seven hard events from rows for the owner, immediately and without a name", async () => {
    const since = new Date("2026-09-10T15:00:00Z");
    // A refund needs a reason code; the seed carries none for refunds yet.
    await db.admin.query("INSERT INTO reason_codes (tenant_id, code, kind, label) VALUES ($1, 'overpayment', 'refund', 'Patient overpayment') ON CONFLICT DO NOTHING", [tenantId]);
    // After hours: 02:30 UTC on the 16th is 21:30 on Tuesday the 15th at Main (Chicago), which closes at 19:00.
    // With the trigger on, this row is impossible (the hold refuses it; see the next case), so it is planted with
    // the trigger off and the hard event says the hold did not run on it.
    await insertEntry({ id: uuidv7(34_010), kind: "refund", amountCents: 12_000, effectiveDate: "2026-09-15", postedAt: "2026-09-16T02:30:00Z", disableTrigger: true });
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
    // A first posting into a day the practice sealed (Increment 1.42). The seal is on
    // 2026-09-14 so the later detector case, which seals 2026-09-15, stays separate.
    await db.admin.query(
      `INSERT INTO day_closes (id, tenant_id, location_id, business_date, status, deposit_total_cents, day_sheet_total_cents,
                               variance_cents, summary, created_at, frozen_at, frozen_by_id, frozen_by_name)
       VALUES ($1, $2, $3, '2026-09-14', 'frozen', 0, 0, 0, '{}', now(), now(), $4, 'Riley Owner')`,
      [uuidv7(34_040), tenantId, SEED_LEDGER.locationId, owner.id]
    );
    await insertEntry({ id: sealedIds.first, kind: "patient_payment", amountCents: -4_500, effectiveDate: "2026-09-14", postedAt: "2026-09-16T16:00:00Z" });

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
    const sealed = events.filter((e) => e.kind === "sealed_day_posting");
    expect(sealed.map((e) => e.subjectId)).toEqual([sealedIds.first]);
    expect(sealed[0]!.href).toBe("/day-close");
    expect(sealed[0]!.sentence).toBe(
      "A $45.00 patient payment posted on 2026-09-16 landed against 2026-09-14, a day the practice had already sealed. The sealed figures do not move, so that day's count and that day's ledger now differ."
    );
    expect(sealed[0]!.sentence).not.toMatch(/Riley|Finn/);
    expect(byKind.get("after_hours_refund")!.sentence).toBe(
      "A $120.00 refund was posted on Tuesday 2026-09-15 at 21:30 local time; Main is open 07:00 to 19:00 that day. Posted with no second person: the after-hours hold did not run on this row."
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

  describe("the after-hours hold", () => {
    const front = DEV_USERS[1]!;
    let savedHours: unknown;
    const AFTER_HOURS_WHY =
      /^Exception "After-hours hold" forces dual release\. Posted at \d{2}:\d{2} local time on [A-Z][a-z]+ \d{4}-\d{2}-\d{2}; Main is closed that day\.$/;

    beforeAll(async () => {
      const { rows } = await db.admin.query("SELECT hours FROM locations WHERE id = $1", [SEED_LEDGER.locationId]);
      savedHours = rows[0].hours as unknown;
      // Close the location all week for these cases, so the real clock counts as after hours whenever the suite runs.
      await db.admin.query("UPDATE locations SET hours = '{}'::jsonb WHERE id = $1", [SEED_LEDGER.locationId]);
      // A refund is initiated by an Office Manager or the owner; the front desk becomes one for these cases.
      await db.admin.query(
        "INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from) VALUES ($1, $2, $3, 'approve_writeoffs', now())",
        [uuidv7(34_040), tenantId, front.id]
      );
      await db.admin.query(
        "INSERT INTO reason_codes (tenant_id, code, kind, label) VALUES ($1, 'overpayment', 'refund', 'Patient overpayment') ON CONFLICT DO NOTHING",
        [tenantId]
      );
    });

    afterAll(async () => {
      await db.admin.query("UPDATE locations SET hours = $2::jsonb WHERE id = $1", [SEED_LEDGER.locationId, JSON.stringify(savedHours)]);
    });

    it("holds a small write-off posted after hours, at the service and at the database, until a second person decides", async () => {
      // $12 is far under the $150 write-off threshold; the hours scope holds it anyway, and the refusal says when and where.
      const held = await withTenantTransaction(
        tenantId,
        front.id,
        (d) =>
          postLedgerEntry(d, {
            tenantId,
            actorId: front.id,
            actorName: front.displayName,
            post: { accountId: SEED_LEDGER.accountDoeId, patientId: SEED_LEDGER.patientJaneId, kind: "write_off", amountCents: 1_200, effectiveDate: SEED_STORY_WEEK.effective, reasonCode: "courtesy" },
          }),
        env
      );
      expect(held).toMatchObject({ ok: false, status: "needs_second" });
      const heldResult = held as { approvalRequestId: string; why: string };
      expect(heldResult.why).toMatch(AFTER_HOURS_WHY);

      // The database is the second lock: the same row posted alone is refused, threshold or no threshold.
      await expect(
        insertEntry({ id: uuidv7(34_041), kind: "write_off", amountCents: -1_200, effectiveDate: SEED_STORY_WEEK.effective, postedAt: new Date().toISOString() })
      ).rejects.toThrow(/after-hours hold/);

      // The owner decides; the posting runs citing the request and the trigger accepts it.
      const approved = await approveAndPost(tenantId, { id: owner.id, name: owner.displayName }, heldResult.approvalRequestId, env);
      expect(approved.ok).toBe(true);
    });

    it("reads a held after-hours refund as 'held, still waiting', then as approved once a second person decides", async () => {
      // The posting screen posts no refunds yet, so this case builds the held request the way the service does:
      // the evaluator sees the hours fact, the request carries it, and the approval re-evaluates on it.
      const heldPayload = await tx(async (d) => {
        const facts = await afterHoursFactsFor(d, tenantId, SEED_LEDGER.locationId, new Date());
        expect(facts).toMatchObject({ locationName: "Main", window: null });
        const active = await loadActivePolicy(d, tenantId);
        const { people } = await loadStaff(d, tenantId);
        const payload: PostEntryInput = {
          tenantId,
          accountId: SEED_LEDGER.accountDoeId,
          patientId: SEED_LEDGER.patientJaneId,
          locationId: SEED_LEDGER.locationId,
          kind: "refund",
          glBucket: "patient_ar",
          amountCents: 1_200,
          reasonCode: "overpayment",
          effectiveDate: SEED_STORY_WEEK.effective,
          postedAt: new Date().toISOString(),
          createdById: front.id,
          createdByName: front.displayName,
          afterHours: facts,
        };
        const evaluation = evaluateRelease(
          active!.policy,
          { channel: "check", amountUsd: 12, initiatorPersonId: front.id, outsideBusinessHours: true },
          people
        );
        expect(evaluation.status).toBe("needs_second");
        const request = await createApprovalRequest(d, {
          tenantId,
          channel: "check",
          amountCents: 1_200,
          heldPayload: payload,
          evaluation,
          requesterId: front.id,
          requesterName: front.displayName,
        });
        return { requestId: request.id };
      });

      // Until someone decides, the hard event reads "held, still waiting", never "posted".
      const window = { since: new Date(Date.now() - 3_600_000), now: new Date() };
      let events = await tx((d) => listHardEvents(d, tenantId, window));
      const waiting = events.find((e) => e.subjectId === heldPayload.requestId);
      expect(waiting?.kind).toBe("after_hours_refund");
      expect(waiting?.sentence).toMatch(/^A \$12\.00 refund is held, still waiting for a second person on .* Main is closed that day\.$/);
      expect(waiting?.href).toBe("/approvals");

      // The database refuses the same refund posted alone, whatever the amount.
      await expect(
        insertEntry({ id: uuidv7(34_042), kind: "refund", amountCents: 1_200, effectiveDate: SEED_STORY_WEEK.effective, postedAt: new Date().toISOString() })
      ).rejects.toThrow(/after-hours hold/);

      // The owner decides; the posting cites the request, the trigger accepts it, and the event now reads approved.
      const approved = await approveAndPost(tenantId, { id: owner.id, name: owner.displayName }, heldPayload.requestId, env);
      expect(approved.ok).toBe(true);
      const entryId = (approved as { entryId: string }).entryId;
      events = await tx((d) => listHardEvents(d, tenantId, { since: window.since, now: new Date() }));
      expect(events.find((e) => e.subjectId === heldPayload.requestId)).toBeUndefined();
      expect(events.find((e) => e.subjectId === entryId)?.sentence).toMatch(
        /^A \$12\.00 refund was posted on .* Main is closed that day\. Held for a second person, who approved it\.$/
      );
    });

    it("lets a small after-hours write-off through once the owner switches the hold off with a decision, and holds again once it is back on", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const actor = { id: owner.id, name: owner.displayName };
      const off = await tx((d) =>
        retireException(d, {
          tenantId,
          actor,
          exceptionId: AFTER_HOURS_HOLD_EXCEPTION.id,
          decision: { kind: "accept_residual", note: "Two people staff the evening clinic through the year end.", reviewBy: addDays(today, 90) },
        })
      );
      expect(off.ok).toBe(true);
      // The trigger reads the active policy: with the hold off, $12 under the threshold posts alone.
      await insertEntry({ id: uuidv7(34_043), kind: "write_off", amountCents: -1_200, effectiveDate: today, postedAt: new Date().toISOString() });

      const on = await tx((d) => restoreException(d, { tenantId, actor, exceptionId: AFTER_HOURS_HOLD_EXCEPTION.id }));
      expect(on.ok).toBe(true);
      await expect(
        insertEntry({ id: uuidv7(34_044), kind: "write_off", amountCents: -1_200, effectiveDate: today, postedAt: new Date().toISOString() })
      ).rejects.toThrow(/after-hours hold/);
    });
  });

  // Last, because it seals a second day and posts behind it. The hard-events case
  // above already sealed 2026-09-14 and planted one row there, so this case reads
  // the detector rather than re-proving the alert.
  it("opens a finding for each first posting behind a seal, and reads a second one as a pattern", async () => {
    const sealedDay = "2026-09-15";
    const closeId = uuidv7(34_050);
    await db.admin.query(
      `INSERT INTO day_closes (id, tenant_id, location_id, business_date, status, deposit_total_cents, day_sheet_total_cents,
                               variance_cents, summary, created_at, frozen_at, frozen_by_id, frozen_by_name)
       VALUES ($1, $2, $3, $4, 'frozen', 0, 0, 0, '{}', now(), now(), $5, 'Riley Owner')`,
      [closeId, tenantId, SEED_LEDGER.locationId, sealedDay, owner.id]
    );

    // The seal is read at insert time, so this row carries the stamp and names its day.
    await insertEntry({ id: sealedIds.late, kind: "patient_payment", amountCents: -4_000, effectiveDate: sealedDay, postedAt: "2026-09-17T14:30:00Z" });
    const stamped = await db.admin.query("SELECT posted_after_close, closed_day_id FROM ledger_entries WHERE id = $1", [sealedIds.late]);
    expect(stamped.rows[0]).toEqual({ posted_after_close: true, closed_day_id: closeId });

    await tx((d) => refreshLedgerFindings(d, tenantId, now));
    const openNow = () =>
      tx((d) => listControlFindings(d, tenantId)).then((rows) => rows.filter((r) => r.kind === SEALED_DAY_POSTING_KIND && r.status === "open"));

    // Two sealed days, one first posting behind each: both slips, neither a pattern.
    let findings = await openNow();
    expect(findings.map((r) => r.subjectId).sort()).toEqual([sealedIds.first, sealedIds.late].sort());
    expect(findings.every((r) => r.severity === "medium")).toBe(true);
    const mine = findings.find((r) => r.subjectId === sealedIds.late)!;
    expect(mine).toMatchObject({ subjectKind: "ledger_entry" });
    expect(mine.detail).toMatchObject({ sealedDay, closedDayId: closeId, postingsBehindThatSeal: 1 });
    expect((mine.detail as { sentence: string }).sentence).toBe(
      "A $40.00 patient payment posted 2026-09-17 landed against 2026-09-15, a day the practice had already sealed. The sealed figures do not move, so that day's count and that day's ledger now differ."
    );
    expect(JSON.stringify(mine.detail)).not.toMatch(/Riley|Finn/);

    // A second first posting behind the same seal turns that day's rows high; the
    // lone row behind the other seal stays medium, because it is still a slip.
    await insertEntry({ id: sealedIds.second, kind: "patient_payment", amountCents: -6_000, effectiveDate: sealedDay, postedAt: "2026-09-17T14:40:00Z" });
    await tx((d) => refreshLedgerFindings(d, tenantId, now));
    findings = await openNow();
    expect(findings).toHaveLength(3);
    const bySubject = new Map(findings.map((r) => [r.subjectId, r]));
    expect(bySubject.get(sealedIds.late)!.severity).toBe("high");
    expect(bySubject.get(sealedIds.second)!.severity).toBe("high");
    expect(bySubject.get(sealedIds.first)!.severity).toBe("medium");
    expect((bySubject.get(sealedIds.late)!.detail as { sentence: string }).sentence).toMatch(/2 first postings have landed behind that seal\.$/);
    expect((bySubject.get(sealedIds.first)!.detail as { sentence: string }).sentence).not.toMatch(/have landed behind that seal/);
  });
});
