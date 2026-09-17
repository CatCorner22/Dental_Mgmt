import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { createBankStatementImport } from "../bank/import";
import { clearReconciliationRun } from "../reconciliation/clear";
import { listDecisions, recordDecision, reviewDecision } from "./decisions";
import { measuredEffectSentence, measuredEffectSince } from "../home/measuredEffect";
import { acknowledgeDigest, computeDigest, digestHash, loadDigestAck, periodEnding } from "../digest/digest";
import {
  countOpenControlFindings,
  DECISION_UNREVIEWED_KIND,
  DEGRADED_CLEARANCE_KIND,
  DEPOSIT_NOT_BANKED_KIND,
  governingFindingDecision,
  listControlFindings,
  listOpenBankLines,
  refreshDegradedClearanceFindings,
  refreshDepositNotBankedFindings,
  refreshSoleHolderFindings,
  refreshUnmatchedBankLineFindings,
  refreshUnreviewedDecisionFindings,
  SOLE_HOLDER_KIND,
  summarizeFindings,
  UNMATCHED_BANK_LINE_KIND,
} from "./detectors";
import { seedControlPolicy } from "./policy";
import { takeSnapshot } from "./snapshots";

/**
 * The unmatched-bank-line detector on live rows, as app_rw, through the
 * real import and clearance paths: nothing before a statement; findings for
 * the lines older than 48 hours and none for a line posted yesterday; the
 * snapshot freeze running the detector; clearance closing the findings
 * with a reason; a repeat import of the same statement leaving them
 * closed. Skipped without PMS_TEST_POSTGRES_URL; mandatory under
 * PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(33_000), name: "Ridgeview Family Dental", slug: "ridgeview-dt" };
const owner = { id: uuidv7(33_001), username: "dt-owner", name: "Riley Owner", role: "admin" };
const front = { id: uuidv7(33_002), username: "dt-front", name: "Jordan Blake", role: "user" };
const location = { id: uuidv7(33_010) };
const bank = { id: uuidv7(33_020) };
const now = new Date("2026-09-17T14:00:00Z");

const CSV = [
  "Date,Description,Amount,Reference",
  "2026-09-12,DEPOSIT CASH MAIN,250.00,",
  "2026-09-13,ACH MERCHANT FEE,-150.00,",
  "2026-08-10,WIRE FEE,-25.00,",
  "2026-09-16,DEPOSIT CASH MAIN,40.00,",
].join("\n");

describe.skipIf(!adminUrl)("Unmatched bank line detector (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  let runId = "";

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as = owner) {
    return withTenantTransaction(tenant.id, as.id, fn, env);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    env = {
      POSTGRES_URL: await db.loginAs("app_rw"),
      APPEND_ROLE_DSN: await db.loginAs("app_append"),
      BCRYPT_COST: "4",
    };
    await db.admin.query("INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())", [tenant.id, tenant.name, tenant.slug]);
    for (const u of [owner, front]) {
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, clinical_role,
                            mfa_enrolled_at, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, 'x', $5, 'unset', now(), now(), now() - interval '2 years')`,
        [u.id, tenant.id, u.username, u.name, u.role]
      );
    }
    for (const [u, entitlement] of [
      [owner, "bank_reconcile"],
      [owner, "run_import"],
      [front, "post_payments"],
      [front, "prepare_deposit"],
    ] as const) {
      await db.admin.query(
        `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
         VALUES ($1, $2, $3, $4, now() - interval '1 year')`,
        [uuidv7(), tenant.id, u.id, entitlement]
      );
    }
    await db.admin.query(
      "INSERT INTO locations (id, tenant_id, name, timezone, active, created_at) VALUES ($1, $2, 'Main', 'America/Chicago', true, now())",
      [location.id, tenant.id]
    );
    await db.admin.query(
      "INSERT INTO bank_accounts (id, tenant_id, location_id, display_name, created_at) VALUES ($1, $2, $3, 'Operating', now())",
      [bank.id, tenant.id, location.id]
    );
    await tx((d) => seedControlPolicy(d, { tenantId: tenant.id, createdById: owner.id, createdByName: owner.name }));
    await db.admin.query(
      `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                             reference, status, prepared_by_id, prepared_by_name, created_at)
       VALUES ($1, $2, $3, $4, '2026-09-12', 'cash', 25000, 'bag-12', 'open', $5, $6, '2026-09-12T22:00:00Z')`,
      [uuidv7(33_100), tenant.id, location.id, bank.id, front.id, front.name]
    );
  }, 60_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("records nothing before a statement exists", async () => {
    const summary = await tx((d) => refreshUnmatchedBankLineFindings(d, tenant.id, now));
    expect(summary).toMatchObject({ inserted: 0, open: 0, closed: 0 });
    expect(await tx((d) => countOpenControlFindings(d, tenant.id))).toBe(0);
  });

  it("opens one finding per unmatched line older than 48 hours, graded by age, and none for yesterday's line", async () => {
    const result = await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: CSV,
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-17T09:00:00Z"),
      })
    );
    expect(result).toMatchObject({ matchedDepositCount: 1, unmatchedCount: 3 });
    runId = result.reconciliationRunId;

    const lines = await tx((d) => listOpenBankLines(d, tenant.id, now));
    expect(lines.map((l) => [l.description, l.ageDays]).sort()).toEqual([
      ["ACH MERCHANT FEE", 4],
      ["WIRE FEE", 38],
    ]);

    // The snapshot freeze is where the detectors run in the product.
    await tx((d) => takeSnapshot(d, { tenantId: tenant.id, actor: owner, trigger: "manual", now }));
    const all = await tx((d) => listControlFindings(d, tenant.id));
    // The freeze runs every detector; the sole-holder detector also opens two rows on this fixture (tested below).
    expect(all.filter((r) => r.kind === SOLE_HOLDER_KIND)).toHaveLength(2);
    const rows = all.filter((r) => r.kind === UNMATCHED_BANK_LINE_KIND);
    expect(rows).toHaveLength(2);
    const byDesc = new Map(rows.map((r) => [(r.detail as { description: string }).description, r]));
    expect(byDesc.get("ACH MERCHANT FEE")).toMatchObject({ status: "open", severity: "low", kind: "unmatched_bank_line_48h", subjectKind: "bank_transaction" });
    expect(byDesc.get("WIRE FEE")).toMatchObject({ status: "open", severity: "high" });
    expect((byDesc.get("WIRE FEE")!.detail as { sentence: string }).sentence).toBe(
      "A $25.00 bank debit posted 2026-08-10 (WIRE FEE) has had no matching deposit and no clearance for 38 days."
    );
    for (const r of rows) {
      expect(JSON.stringify(r.detail)).not.toMatch(/Riley|Jordan|Owner|Blake/);
    }

    // A second run on the same clock refreshes rather than duplicates.
    const again = await tx((d) => refreshUnmatchedBankLineFindings(d, tenant.id, now));
    expect(again).toMatchObject({ inserted: 0, refreshed: 2, open: 2 });
  });

  it("closes the findings with a reason once the run is cleared, and a repeat import leaves them closed", async () => {
    const cleared = await tx((d) =>
      clearReconciliationRun(d, {
        tenantId: tenant.id,
        runId,
        actor: { id: owner.id, role: owner.role, entitlements: ["bank_reconcile", "run_import"], displayName: owner.name },
        now: new Date("2026-09-17T15:00:00Z"),
      })
    );
    expect(cleared.status).toBe("cleared");
    const later = new Date("2026-09-17T16:00:00Z");
    expect(await tx((d) => refreshUnmatchedBankLineFindings(d, tenant.id, later))).toMatchObject({ closed: 2, open: 0 });
    const rows = (await tx((d) => listControlFindings(d, tenant.id))).filter((r) => r.kind === UNMATCHED_BANK_LINE_KIND);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "closed" && r.closedReason === "matched or cleared" && r.closedAt)).toBe(true);

    await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: CSV,
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-17T17:00:00Z"),
      })
    );
    expect(await tx((d) => refreshUnmatchedBankLineFindings(d, tenant.id, new Date("2026-09-17T18:00:00Z")))).toMatchObject({
      inserted: 0,
      reopened: 0,
      open: 0,
    });
    // Only the two sole-holder rows from the freeze stay open.
    expect(await tx((d) => countOpenControlFindings(d, tenant.id))).toBe(2);
  });

  it("records owner-only clearance inside the window as a finding and closes it once the run ages out", async () => {
    const insertRun = (id: string, periodStart: string, periodEnd: string, clearedAt: string, degraded: boolean) =>
      db.admin.query(
        `INSERT INTO reconciliation_runs (id, tenant_id, bank_account_id, source, period_start, period_end, status, summary,
                                          created_at, created_by_id, created_by_name, cleared_at, cleared_by_id, cleared_by_name)
         VALUES ($1, $2, $3, 'statement_import', $4, $5, 'cleared', $6, $7, $8, $9, $7, $8, $9)`,
        [id, tenant.id, bank.id, periodStart, periodEnd, JSON.stringify(degraded ? { degradedOwnerClearance: true } : {}), clearedAt, owner.id, owner.name]
      );
    const degradedRun = uuidv7(33_300);
    await insertRun(degradedRun, "2026-09-08", "2026-09-10", "2026-09-11T18:00:00Z", true);
    await insertRun(uuidv7(33_301), "2026-09-01", "2026-09-05", "2026-09-06T18:00:00Z", false);
    await insertRun(uuidv7(33_302), "2026-06-01", "2026-06-05", "2026-06-06T18:00:00Z", true); // outside the window

    const first = await tx((d) => refreshDegradedClearanceFindings(d, tenant.id, now));
    expect(first).toMatchObject({ kind: DEGRADED_CLEARANCE_KIND, inserted: 1, open: 1 });
    const rows = (await tx((d) => listControlFindings(d, tenant.id))).filter((r) => r.kind === DEGRADED_CLEARANCE_KIND);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ subjectKind: "reconciliation_run", subjectId: degradedRun, severity: "medium", status: "open" });
    expect((rows[0]!.detail as { sentence: string }).sentence).toMatch(/^The reconciliation run for 2026-09-08 to 2026-09-10 was cleared on 2026-09-11 as owner-only clearance/);
    expect(JSON.stringify(rows[0]!.detail)).not.toMatch(/Riley|Owner/);

    // Sixty days on, the run has left the 45-day window and the finding closes with that reason.
    const later = await tx((d) => refreshDegradedClearanceFindings(d, tenant.id, new Date("2026-11-16T12:00:00Z")));
    expect(later).toMatchObject({ closed: 1, open: 0 });
    const closed = (await tx((d) => listControlFindings(d, tenant.id))).find((r) => r.subjectId === degradedRun);
    expect(closed).toMatchObject({ status: "closed", closedReason: "outside the 45-day window" });
  });

  it("records an active decision past its review date and closes the finding when a new decision supersedes it", async () => {
    const overdueId = uuidv7(33_400);
    const insertDecision = (id: string, reviewBy: string, supersedes: string | null) =>
      db.admin.query(
        `INSERT INTO control_decisions (id, tenant_id, subject_kind, subject_id, kind, note, review_by, supersedes_decision_id,
                                        decided_by_id, decided_by_name, decided_at, scoring_version, rulebook_version)
         VALUES ($1, $2, 'sod_finding', $3, 'accept_residual', 'Owner reconciles independently on Fridays.', $4, $5,
                 $6, $7, now(), 'precog-residual-v1.1.0', '0.1.0')`,
        [id, tenant.id, `${front.id}:rule-cash-rec`, reviewBy, supersedes, owner.id, owner.name]
      );
    await insertDecision(overdueId, "2026-08-01", null);

    const first = await tx((d) => refreshUnreviewedDecisionFindings(d, tenant.id, now));
    expect(first).toMatchObject({ kind: DECISION_UNREVIEWED_KIND, inserted: 1, open: 1 });
    const open = (await tx((d) => listControlFindings(d, tenant.id))).find((r) => r.kind === DECISION_UNREVIEWED_KIND);
    expect(open).toMatchObject({ subjectKind: "control_decision", subjectId: overdueId, severity: "high", status: "open" });
    expect((open!.detail as { daysOverdue: number; sentence: string }).daysOverdue).toBe(47);
    expect((open!.detail as { sentence: string }).sentence).toMatch(/was due for review on 2026-08-01 and has been past that date for 47 days/);
    expect(JSON.stringify(open!.detail)).not.toMatch(/Riley/);

    await insertDecision(uuidv7(33_401), "2026-12-01", overdueId);
    const after = await tx((d) => refreshUnreviewedDecisionFindings(d, tenant.id, now));
    expect(after).toMatchObject({ closed: 1, open: 0 });
    const closed = (await tx((d) => listControlFindings(d, tenant.id))).find((r) => r.subjectId === overdueId);
    expect(closed).toMatchObject({ status: "closed", closedReason: "superseded" });
    // Nothing but the two sole-holder rows from the freeze stays open.
    const stillOpen = (await tx((d) => listControlFindings(d, tenant.id))).filter((r) => r.status === "open");
    expect(stillOpen.map((r) => r.kind)).toEqual([SOLE_HOLDER_KIND, SOLE_HOLDER_KIND]);
  });

  it("flags a deposit with no bank credit after five days and closes it once a statement matches it", async () => {
    // The 12th's $250 cash deposit was matched by the first statement; a $40 check from the 8th never reached a statement.
    const lateDeposit = uuidv7(33_500);
    await db.admin.query(
      `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                             reference, status, prepared_by_id, prepared_by_name, created_at)
       VALUES ($1, $2, $3, $4, '2026-09-08', 'Check', 4000, '2001', 'open', $5, $6, '2026-09-08T22:00:00Z')`,
      [lateDeposit, tenant.id, location.id, bank.id, front.id, front.name]
    );
    const first = await tx((d) => refreshDepositNotBankedFindings(d, tenant.id, now));
    expect(first).toMatchObject({ kind: DEPOSIT_NOT_BANKED_KIND, inserted: 1, open: 1 });
    const row = (await tx((d) => listControlFindings(d, tenant.id))).find((r) => r.kind === DEPOSIT_NOT_BANKED_KIND);
    expect(row).toMatchObject({ subjectKind: "deposit", subjectId: lateDeposit, severity: "medium", status: "open" });
    expect((row!.detail as { sentence: string }).sentence).toBe("A $40.00 check deposit prepared for 2026-09-08 has no matching bank credit after 9 days.");
    expect(JSON.stringify(row!.detail)).not.toMatch(/Jordan|Blake/);

    // The bank's record of it arrives: the matcher pairs the credit with the deposit and the finding closes.
    const result = await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: ["Date,Description,Amount,Reference", "2026-09-08,DEPOSIT CHECK 2001,40.00,2001"].join("\n"),
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-17T19:00:00Z"),
      })
    );
    expect(result.matchedDepositCount).toBe(1);
    const after = await tx((d) => refreshDepositNotBankedFindings(d, tenant.id, new Date("2026-09-17T19:30:00Z")));
    expect(after).toMatchObject({ closed: 1, open: 0 });
    const closed = (await tx((d) => listControlFindings(d, tenant.id))).find((r) => r.subjectId === lateDeposit);
    expect(closed).toMatchObject({ status: "closed", closedReason: "matched at the bank or outside the 45-day window" });
  });

  it("records a decision on an open finding, refuses one on a closed finding or from the hands the row is about", async () => {
    const all = await tx((d) => listControlFindings(d, tenant.id));
    const ownDuty = all.find((r) => r.kind === SOLE_HOLDER_KIND && r.subjectId === "bank_reconcile")!; // held by the owner alone
    const frontDuty = all.find((r) => r.kind === SOLE_HOLDER_KIND && r.subjectId === "prepare_deposit")!; // held by the front desk alone
    const closedDeposit = all.find((r) => r.kind === DEPOSIT_NOT_BANKED_KIND)!; // closed in the case above
    const actor = { id: owner.id, name: owner.name };
    const base = { tenantId: tenant.id, actor, subjectKind: "detector_finding", note: "Decided for the live test with a reason.", now };

    const unknown = await tx((d) => recordDecision(d, { ...base, subjectId: uuidv7(33_700), kind: "monitor" }));
    expect(unknown).toEqual({ ok: false, errors: ["The finding was not found."] });

    const closed = await tx((d) => recordDecision(d, { ...base, subjectId: closedDeposit.id, kind: "monitor" }));
    expect(closed.ok).toBe(false);
    expect((closed as { errors: string[] }).errors[0]).toMatch(/^The finding is closed/);

    // The owner is the one holder of bank_reconcile: accepting its residual is self-licensing; watching it is not.
    const self = await tx((d) => recordDecision(d, { ...base, subjectId: ownDuty.id, kind: "accept_residual", reviewBy: "2026-12-31" }));
    expect(self.ok).toBe(false);
    expect((self as { errors: string[] }).errors[0]).toMatch(/cannot accept or compensate a finding about your own work/);
    const watch = await tx((d) => recordDecision(d, { ...base, subjectId: ownDuty.id, kind: "monitor", reviewBy: "2026-12-31" }));
    expect(watch.ok).toBe(true);

    // The front desk's duty is someone else's work, so the owner may accept its residual.
    const accepted = await tx((d) => recordDecision(d, { ...base, subjectId: frontDuty.id, kind: "accept_residual", reviewBy: "2026-12-31" }));
    expect(accepted.ok).toBe(true);

    const decisions = await tx((d) => listDecisions(d, tenant.id));
    expect(governingFindingDecision(ownDuty.id, decisions)).toMatchObject({ kind: "monitor", subjectKind: "detector_finding" });
    expect(governingFindingDecision(frontDuty.id, decisions)).toMatchObject({ kind: "accept_residual" });
    const summary = summarizeFindings(await tx((d) => listControlFindings(d, tenant.id)), decisions);
    expect(summary).toMatchObject({ open: 2, decided: 2, undecided: 0 });
    // The detector still owns the row: recording a decision changed no status.
    expect((await tx((d) => listControlFindings(d, tenant.id))).filter((r) => r.kind === SOLE_HOLDER_KIND).every((r) => r.status === "open")).toBe(true);
  });

  it("flags each highest-weight duty held by one active person and closes it once a second holder is live", async () => {
    // Owner: bank_reconcile, run_import. Front: post_payments, prepare_deposit. Weight-5 duties held by exactly one: two.
    // The freeze earlier in this file already opened both rows, so this run refreshes them rather than inserting.
    const first = await tx((d) => refreshSoleHolderFindings(d, tenant.id, now));
    expect(first).toMatchObject({ kind: SOLE_HOLDER_KIND, inserted: 0, refreshed: 2, open: 2 });
    const rows = (await tx((d) => listControlFindings(d, tenant.id))).filter((r) => r.kind === SOLE_HOLDER_KIND);
    expect(rows.map((r) => r.subjectId).sort()).toEqual(["bank_reconcile", "prepare_deposit"]);
    expect(rows.every((r) => r.subjectKind === "entitlement" && r.severity === "medium")).toBe(true);
    for (const r of rows) expect(JSON.stringify(r.detail)).not.toMatch(/Riley|Jordan|Owner|Blake/);

    // A second live holder of prepare_deposit closes that finding; bank_reconcile stays with one.
    // The grant is dated before the as-of instant below, not from the wall clock: a grant the staff
    // loader reads as live must precede the moment the detector runs, whatever time of day CI runs.
    const secondHolderAt = new Date("2026-09-17T19:00:00Z");
    const soleHolderAsOf = new Date("2026-09-17T20:00:00Z");
    await db.admin.query(
      `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from) VALUES ($1, $2, $3, 'prepare_deposit', $4)`,
      [uuidv7(33_600), tenant.id, owner.id, secondHolderAt.toISOString()]
    );
    const after = await tx((d) => refreshSoleHolderFindings(d, tenant.id, soleHolderAsOf));
    expect(after).toMatchObject({ closed: 1, refreshed: 1, open: 1 });
    const closed = (await tx((d) => listControlFindings(d, tenant.id))).find((r) => r.kind === SOLE_HOLDER_KIND && r.subjectId === "prepare_deposit");
    expect(closed).toMatchObject({ status: "closed", closedReason: "a second holder is live, or none is" });
  });

  it("reviews a decision by keeping, tightening, and retiring it, one superseding row each, and measures what happened since", async () => {
    const actor = { id: owner.id, name: owner.name };
    const ownDuty = (await tx((d) => listControlFindings(d, tenant.id))).find((r) => r.kind === SOLE_HOLDER_KIND && r.subjectId === "bank_reconcile")!;
    const before = await tx((d) => listDecisions(d, tenant.id));
    const monitor = governingFindingDecision(ownDuty.id, before)!;
    expect(monitor.kind).toBe("monitor");

    // What happened since the decision, over the practice's rows: this fixture posted nothing to the ledger,
    // cleared one run (not owner-only), and the detectors opened and closed rows after the decision was made.
    const effect = await tx((d) => measuredEffectSince(d, tenant.id, new Date(monitor.decidedAt)));
    expect(effect).toMatchObject({ since: "2026-09-17", postings: 0, guardedWithSecond: 0, guardedWithoutSecond: 0 });
    expect(measuredEffectSentence(effect)).toMatch(/^Since this decision on 2026-09-17: 0 postings; .* Directional and practice-wide; no one is named\.$/);

    const unknown = await tx((d) => reviewDecision(d, { tenantId: tenant.id, actor, decisionId: uuidv7(33_800), action: "keep", now }));
    expect(unknown).toMatchObject({ ok: false, status: 404 });

    // Keep: same kind and note, reviewed again 90 days out.
    const kept = await tx((d) => reviewDecision(d, { tenantId: tenant.id, actor, decisionId: monitor.id, action: "keep", now }));
    expect(kept.ok).toBe(true);
    const keptRow = (kept as { decision: { id: string; kind: string; note: string; reviewBy?: string; supersedesDecisionId?: string } }).decision;
    expect(keptRow).toMatchObject({ kind: "monitor", note: monitor.note, reviewBy: "2026-12-16", supersedesDecisionId: monitor.id });

    // The register moves forward only: the superseded row cannot be reviewed again.
    const stale = await tx((d) => reviewDecision(d, { tenantId: tenant.id, actor, decisionId: monitor.id, action: "keep", now }));
    expect(stale).toMatchObject({ ok: false, status: 409 });

    // Tighten needs a note and lands on remediate, 30 days out.
    const bare = await tx((d) => reviewDecision(d, { tenantId: tenant.id, actor, decisionId: keptRow.id, action: "tighten", now }));
    expect(bare).toMatchObject({ ok: false });
    const tightened = await tx((d) =>
      reviewDecision(d, { tenantId: tenant.id, actor, decisionId: keptRow.id, action: "tighten", note: "A second reconciler is being hired; until then, remediate.", now })
    );
    expect(tightened.ok).toBe(true);
    const tightRow = (tightened as { decision: { id: string; kind: string; reviewBy?: string } }).decision;
    expect(tightRow).toMatchObject({ kind: "remediate", reviewBy: "2026-10-17" });
    expect(governingFindingDecision(ownDuty.id, await tx((d) => listDecisions(d, tenant.id)))?.id).toBe(tightRow.id);

    // Retire ends it: the finding reads as undecided again, and the retirement itself is never due for review.
    const retired = await tx((d) =>
      reviewDecision(d, { tenantId: tenant.id, actor, decisionId: tightRow.id, action: "retire", note: "The bookkeeper now reconciles; nothing left to decide.", now })
    );
    expect(retired.ok).toBe(true);
    expect((retired as { decision: { kind: string; reviewBy?: string } }).decision).toMatchObject({ kind: "retire", reviewBy: undefined });
    const after = await tx((d) => listDecisions(d, tenant.id));
    expect(governingFindingDecision(ownDuty.id, after)).toBeUndefined();
    expect(summarizeFindings(await tx((d) => listControlFindings(d, tenant.id)), after)).toMatchObject({ open: 1, decided: 0, undecided: 1 });
    // A retirement is only ever the end of a decision; it cannot be recorded on its own.
    const bareRetire = await tx((d) =>
      recordDecision(d, { tenantId: tenant.id, actor, subjectKind: "detector_finding", subjectId: ownDuty.id, kind: "retire", note: "Recorded on its own, wrongly.", now })
    );
    expect(bareRetire.ok).toBe(false);
    expect((bareRetire as { errors: string[] }).errors[0]).toMatch(/supersedes an existing decision/);
  });

  it("counts the week the fixture lived into the digest, practice-wide, and stamps it exactly once", async () => {
    const period = periodEnding("2026-09-17");
    const digest = await tx((d) => computeDigest(d, tenant.id, period));
    // Three statements imported (the CSV twice, then the $40 credit), one run cleared by the owner alone, the
    // detectors' rows opened and some closed, the decisions and their three reviews, and the chain that recorded it.
    expect(digest.period).toEqual({ start: "2026-09-11", end: "2026-09-17", days: 7 });
    // Two cleared runs fall in the window: the CSV run the owner cleared (not owner-only: the owner had neither
    // prepared nor posted) and the degraded run the clearance case planted; the older planted run lies outside.
    // The $250 deposit of the 12th was created inside the window, the $40 one of the 8th before it.
    expect(digest.bank.statementsImported).toBe(3);
    expect(digest.bank.runsCleared).toBe(2);
    expect(digest.bank.runsOwnerOnly).toBe(1);
    expect(digest.bank.depositsPrepared).toBe(1);
    // Clearing the CSV run cleared its open lines with a reason, which the chain recorded once.
    expect(digest.bank.variancesClearedWithReason).toBe(1);
    expect(digest.money).toMatchObject({ postingCount: 0, guardedWithSecond: 0, guardedWithoutSecond: 0 });
    // Every detector this fixture exercised opened rows inside the week; the bank-line rows were both closed by the
    // clearance; at week's end only the owner's sole-held duty stays open.
    expect(digest.findings.opened.map((r) => r.key).sort()).toEqual(
      ["decision_unreviewed", "degraded_owner_clearance", "deposit_not_banked", "sole_holder_critical_duty", "unmatched_bank_line_48h"]
    );
    expect(digest.findings.closed.find((r) => r.key === "unmatched_bank_line_48h")?.count).toBe(2);
    expect(digest.findings.openNow).toBe(1);
    // Recorded through the register this week: the watch and its Keep (two monitors), the accepted residual on the
    // front desk's duty, the Tighten (remediate), and the Retire.
    const recorded = Object.fromEntries(digest.decisions.recorded.map((r) => [r.key, r.count]));
    expect(recorded).toMatchObject({ monitor: 2, remediate: 1, retire: 1 });
    expect(recorded.accept_residual).toBeGreaterThanOrEqual(1);
    expect(digest.decisions.reviews).toEqual({ keep: 1, tighten: 1, retire: 1 });
    expect(digest.decisions.snapshotsFrozen).toBe(1);
    expect(digest.chain.events).toBeGreaterThan(5);
    expect(digest.chain.firstSeq).toBe(1);
    expect(digest.chain.acknowledgments).toBe(0);
    // No person's name anywhere in it ("Owner-only clearance" is a process word, not a person).
    expect(JSON.stringify(digest)).not.toMatch(/Riley|Jordan|Blake/);
    const hash = digestHash(digest);

    const actor = { id: owner.id, name: owner.name };
    const stale = await tx((d) => acknowledgeDigest(d, { tenantId: tenant.id, actor, ending: "2026-09-17", summaryHash: "0".repeat(64), now }));
    expect(stale).toMatchObject({ ok: false, status: 409 });
    expect((stale as { errors: string[] }).errors[0]).toMatch(/changed since you read it/);
    const future = await tx((d) => acknowledgeDigest(d, { tenantId: tenant.id, actor, ending: "2026-09-18", summaryHash: hash, now }));
    expect(future).toMatchObject({ ok: false, status: 400 });

    const stamped = await tx((d) => acknowledgeDigest(d, { tenantId: tenant.id, actor, ending: "2026-09-17", summaryHash: hash, now }));
    expect(stamped.ok).toBe(true);
    expect((stamped as { ack: { periodStart: string; periodEnd: string; eventCount: number; summaryHash: string } }).ack).toMatchObject({
      periodStart: "2026-09-11",
      periodEnd: "2026-09-17",
      eventCount: digest.chain.events,
      summaryHash: hash,
    });
    expect(await tx((d) => loadDigestAck(d, tenant.id, "2026-09-17"))).toMatchObject({ acknowledgedByName: owner.name, summaryHash: hash });

    // The stamp is itself an event inside the week, so the digest moved on; a second stamp is refused before that matters.
    const again = await tx((d) => acknowledgeDigest(d, { tenantId: tenant.id, actor, ending: "2026-09-17", summaryHash: hash, now }));
    expect(again).toMatchObject({ ok: false, status: 409 });
    expect((again as { errors: string[] }).errors[0]).toMatch(/already acknowledged by Riley Owner/);
    const after = await tx((d) => computeDigest(d, tenant.id, period));
    expect(after.chain.acknowledgments).toBe(1);
    expect(after.chain.events).toBe(digest.chain.events + 1);
    expect(digestHash(after)).not.toBe(hash);
  });
});
