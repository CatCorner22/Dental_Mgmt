import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_LEDGER } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
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
          input.kind === "write_off" ? "courtesy" : input.kind === "reversal" ? "correction" : null,
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
});
