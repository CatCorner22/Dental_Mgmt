import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { uuidv7 } from "@pms/db";
import { createPostEntry } from "@pms/ledger";
import { resetDbPoolForTests, withTenantTransaction } from "./db/client";
import { makePostgresLedgerWriter } from "./ledger/postgresWriter";
import { createCurveHeroImportRun } from "./import/runs";
import { applyCurveHeroImport } from "./import/apply";
import { mapDaySheetRow } from "./import/map";
import { createBankStatementImport } from "./bank/import";
import { clearReconciliationRun } from "./reconciliation/clear";
import { getReconciliationRun } from "./reconciliation/queries";
import { createDraftStatement } from "./statements/service";
import { buildOwnerBoard } from "./home/board";
import { seedControlPolicy } from "./controls/policy";

/**
 * Swarm 2, lens import-bank-statements: the Curve Hero apply path, the bank
 * statement matcher and clearance, and patient statements, driven through the
 * real service functions as app_rw on a throwaway database. Each test asserts
 * the correct behaviour and fails on the reference commit; the failing
 * assertion is the measured breach. Skipped without PMS_TEST_POSTGRES_URL;
 * mandatory under PMS_TEST_POSTGRES_REQUIRED=1 (see liveDatabase.ts).
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(41_000), name: "Ridgeview Family Dental", slug: "ridgeview-s2-import" };
const other = { id: uuidv7(41_900), name: "Other Practice", slug: "other-s2-import" };
const owner = { id: uuidv7(41_001), username: "s2-owner", name: "Riley Owner", role: "admin" };
const om = { id: uuidv7(41_002), username: "s2-om", name: "Morgan Manager", role: "admin" };
const front = { id: uuidv7(41_003), username: "s2-front", name: "Jordan Blake", role: "user" };
const location = { id: uuidv7(41_010) };
const bank = { id: uuidv7(41_020) };
const otherLocation = { id: uuidv7(41_910) };
const otherBank = { id: uuidv7(41_920) };
const patient = { id: uuidv7(41_030), mrn: "MRN-S2-1", accountId: uuidv7(41_031) };
const asOfNow = new Date("2026-09-16T12:00:00Z");

const DAY_SHEET = [
  "Date,Location,Patient MRN,Patient Name,Transaction Type,Amount",
  `2026-09-12,Main,${patient.mrn},Pat One,Payment,150.00`,
].join("\n");

const DAY_SHEET_WITH_CHARGE = [
  "Date,Location,Patient MRN,Patient Name,Transaction Type,Amount",
  `2026-09-12,Main,${patient.mrn},Pat One,Charge,150.00`,
].join("\n");

const BANK_CSV = [
  "Date,Description,Amount,Reference",
  "2026-09-12,DEPOSIT CASH MAIN,250.00,",
  "2026-09-12,DEPOSIT CHECK 1042,100.00,1042",
  "2026-09-13,ACH MERCHANT FEE,-150.00,",
].join("\n");

describe("S2 import-bank-statements: pure mapping", () => {
  // Negative control: a positive Charge maps to +15000 and a positive Payment to -5000 on the reference commit.
  it("S2-import-bank-statements-7: a negative day-sheet line (reversal) keeps its direction instead of being posted as the original", () => {
    // A -$50 "Payment" line on a Curve Hero day sheet is a payment reversal; posting it as another -$50 payment doubles the credit.
    expect(mapDaySheetRow({
      kind: "day_sheet",
      businessDate: "2026-09-12",
      locationCode: "Main",
      patientMrn: "MRN-1",
      patientName: "Pat One",
      transactionType: "Payment",
      amountCents: -5000,
      providerCode: null,
      description: "Payment reversal",
    })).toMatchObject({ kind: "patient_payment", amountCents: 5000 });
    expect(mapDaySheetRow({
      kind: "day_sheet",
      businessDate: "2026-09-12",
      locationCode: "Main",
      patientMrn: "MRN-1",
      patientName: "Pat One",
      transactionType: "Charge",
      amountCents: -15000,
      providerCode: null,
      description: "Charge reversal",
    })).toMatchObject({ kind: "charge", amountCents: -15000 });
  });
});

describe.skipIf(!adminUrl)("S2 import-bank-statements: apply, matching, clearance, statements (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as = owner, tenantId = tenant.id) {
    return withTenantTransaction(tenantId, as.id, fn, env);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    env = {
      POSTGRES_URL: await db.loginAs("app_rw"),
      APPEND_ROLE_DSN: await db.loginAs("app_append"),
      BCRYPT_COST: "4",
    };
    for (const t of [tenant, other]) {
      await db.admin.query("INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())", [t.id, t.name, t.slug]);
    }
    for (const u of [owner, om, front]) {
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
      [om, "bank_reconcile"],
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
      "INSERT INTO locations (id, tenant_id, name, timezone, active, created_at) VALUES ($1, $2, 'Other Main', 'America/Chicago', true, now())",
      [otherLocation.id, other.id]
    );
    await db.admin.query(
      "INSERT INTO bank_accounts (id, tenant_id, location_id, display_name, created_at) VALUES ($1, $2, $3, 'Operating', now())",
      [bank.id, tenant.id, location.id]
    );
    await db.admin.query(
      "INSERT INTO bank_accounts (id, tenant_id, location_id, display_name, created_at) VALUES ($1, $2, $3, 'Other Operating', now())",
      [otherBank.id, other.id, otherLocation.id]
    );
    await db.admin.query(
      `INSERT INTO patients (id, tenant_id, mrn, first_name, last_name, date_of_birth, primary_location_id, created_by_id, created_by_name)
       VALUES ($1, $2, $3, 'Pat', 'One', '1990-01-01', $4, $5, 'seed')`,
      [patient.id, tenant.id, patient.mrn, location.id, owner.id]
    );
    await db.admin.query(
      `INSERT INTO guarantor_accounts (id, tenant_id, display_name, created_by_id, created_by_name, created_at)
       VALUES ($1, $2, 'Pat One', $3, 'seed', now())`,
      [patient.accountId, tenant.id, owner.id]
    );
    await db.admin.query(
      `INSERT INTO account_members (id, tenant_id, account_id, patient_id, effective_from) VALUES ($1, $2, $3, $4, '2020-01-01')`,
      [uuidv7(), tenant.id, patient.accountId, patient.id]
    );
    await tx((d) => seedControlPolicy(d, { tenantId: tenant.id, createdById: owner.id, createdByName: owner.name }));

    for (const [id, method, amount, reference] of [
      [uuidv7(41_100), "cash", 25_000, "bag-12"],
      [uuidv7(41_101), "check", 10_000, "1042"],
    ] as const) {
      await db.admin.query(
        `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                               reference, status, prepared_by_id, prepared_by_name, created_at)
         VALUES ($1, $2, $3, $4, '2026-09-12', $5, $6, $7, 'open', $8, $9, '2026-09-12T22:00:00Z')`,
        [id, tenant.id, location.id, bank.id, method, amount, reference, front.id, front.name]
      );
    }
  }, 60_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  async function stageAndApply(content: string, at: Date) {
    const run = await tx((d) =>
      createCurveHeroImportRun(d, {
        tenantId: tenant.id,
        reportKind: "day_sheet",
        content,
        fileName: "day-sheet.csv",
        actorUserId: owner.id,
        actorName: owner.name,
        now: at,
      })
    );
    const applied = await tx((d) =>
      applyCurveHeroImport(d, { tenantId: tenant.id, runId: run.runId, actorUserId: owner.id, actorName: owner.name, now: at })
    );
    return { run, applied };
  }

  async function ledgerRows(where: string, params: unknown[]) {
    const { rows } = await db.admin.query(
      `SELECT kind, amount_cents::int AS amount_cents, location_id, effective_date::text AS effective_date, idempotency_key
       FROM ledger_entries WHERE tenant_id = $1 AND ${where} ORDER BY posted_at, id`,
      [tenant.id, ...params]
    );
    return rows;
  }

  // Negative control: the same day sheet with the row typed "Payment" applies (posted: 1) on the reference commit.
  it("S2-import-bank-statements-8: applying a validated day sheet that contains a Charge row posts it or reports a row error, instead of aborting the whole apply", async () => {
    const run = await tx((d) =>
      createCurveHeroImportRun(d, {
        tenantId: tenant.id,
        reportKind: "day_sheet",
        content: DAY_SHEET_WITH_CHARGE,
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-13T14:00:00Z"),
      })
    );
    expect(run.status).toBe("validated");
    const apply = tx((d) =>
      applyCurveHeroImport(d, { tenantId: tenant.id, runId: run.runId, actorUserId: owner.id, actorName: owner.name })
    );
    await expect(apply).resolves.toMatchObject({ runIds: [run.runId] });
  });

  // Negative control: applying the SAME run twice posts once (idempotency key import:curve:<runId>:<row>).
  it("S2-import-bank-statements-9: the same day sheet file staged and applied a second time does not post its lines again", async () => {
    const first = await stageAndApply(DAY_SHEET, new Date("2026-09-13T15:00:00Z"));
    expect(first.run.status).toBe("validated");
    expect(first.applied).toMatchObject({ posted: 1, duplicates: 0 });

    // The front desk uploads the same export again (same bytes, same file hash) and clicks Apply.
    const second = await stageAndApply(DAY_SHEET, new Date("2026-09-13T15:05:00Z"));
    const rows = await ledgerRows("patient_id = $2 AND kind = 'patient_payment' AND amount_cents = -15000 AND effective_date = '2026-09-12'", [patient.id]);
    expect({
      secondRunStatus: second.run.status,
      secondApply: { posted: second.applied.posted, duplicates: second.applied.duplicates, errors: second.applied.errors },
      paymentsOnLedger: rows.length,
    }).toMatchObject({ paymentsOnLedger: 1 });
  });

  // Negative control: a row whose Location is "Main" posts to the Main location on the reference commit.
  it("S2-import-bank-statements-10: a day-sheet row for a location the tenant does not have is refused, not posted to the first location", async () => {
    const csv = [
      "Date,Location,Patient MRN,Patient Name,Transaction Type,Amount",
      `2026-09-11,Northside,${patient.mrn},Pat One,Payment,42.00`,
    ].join("\n");
    const { applied } = await stageAndApply(csv, new Date("2026-09-13T16:00:00Z"));
    const rows = await ledgerRows("patient_id = $2 AND amount_cents = -4200", [patient.id]);
    expect({ posted: applied.posted, errors: applied.errors.map((e) => e.code), postedTo: rows.map((r) => r.location_id) }).toEqual({
      posted: 0,
      errors: ["location_not_found"],
      postedTo: [],
    });
  });

  // Negative control: a draft as of today shows the full current balance on the reference commit.
  it("S2-import-bank-statements-11: a statement drafted as of a date shows the balance as of that date, not today's", async () => {
    const post = (d: Parameters<Parameters<typeof tx>[0]>[0]) => createPostEntry(makePostgresLedgerWriter(d));
    for (const [effectiveDate, amount] of [
      ["2026-09-01", -10_000],
      ["2026-09-20", -5_000],
    ] as const) {
      const result = await tx((d) =>
        post(d)({
          tenantId: tenant.id,
          accountId: patient.accountId,
          patientId: patient.id,
          locationId: location.id,
          kind: "patient_payment",
          glBucket: "patient_ar",
          amountCents: amount,
          effectiveDate,
          createdById: front.id,
          createdByName: front.name,
          tender: "cash",
          idempotencyKey: `s2-asof-${effectiveDate}`,
        }),
        front
      );
      expect(result.ok).toBe(true);
    }

    const draft = await tx((d) =>
      createDraftStatement(d, {
        tenantId: tenant.id,
        accountId: patient.accountId,
        patientId: patient.id,
        asOf: "2026-09-10",
        actorUserId: front.id,
        actorName: front.name,
        now: asOfNow,
      }),
      front
    );
    expect("error" in draft).toBe(false);
    if ("error" in draft) return;
    const lines = draft.snapshot.lines.map((e) => ({ effectiveDate: e.effectiveDate, amountCents: e.amountCents }));
    expect({ asOf: draft.asOf, lines, creditCents: draft.creditCents }).toMatchObject({
      asOf: "2026-09-10",
      lines: lines.filter((l) => l.effectiveDate <= "2026-09-10"),
    });
    expect(draft.creditCents).toBe(10_000);
  });

  // Negative control: an import against the tenant's own bank account succeeds with status validated.
  it("S2-import-bank-statements-12: a statement import against another tenant's bank account is refused", async () => {
    const attempt = tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: otherBank.id,
        content: BANK_CSV,
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-14T15:00:00Z"),
      })
    );
    await expect(attempt).rejects.toThrow();
    const { rows } = await db.admin.query(
      "SELECT count(*)::int AS n FROM bank_transactions WHERE tenant_id = $1 AND bank_account_id = $2",
      [tenant.id, otherBank.id]
    );
    expect(rows[0].n).toBe(0);
  });

  // Negative control: before the re-import the cleared run reads "cleared" and the owner board reads the day as tied.
  it("S2-import-bank-statements-13: re-importing an already cleared statement does not reopen its lines as variances on the owner board", async () => {
    const imported = await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: BANK_CSV,
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-14T15:00:00Z"),
      })
    );
    expect(imported).toMatchObject({ status: "validated", matchedDepositCount: 2, unmatchedCount: 1 });
    const runId = imported.reconciliationRunId;
    const cleared = await tx((d) =>
      clearReconciliationRun(d, {
        tenantId: tenant.id,
        runId,
        actor: { id: om.id, role: om.role, entitlements: ["bank_reconcile"], displayName: om.name },
        now: new Date("2026-09-15T10:00:00Z"),
      }),
      om
    );
    expect(cleared.status === "cleared" ? "cleared" : JSON.stringify(cleared)).toBe("cleared");
    const before = await tx((d) => buildOwnerBoard(d, tenant.id, owner.id, asOfNow));
    expect(before.yesterday.headline).not.toMatch(/variance/);

    // The bank's export overlaps: the same statement lands a second time.
    const again = await tx((d) =>
      createBankStatementImport(d, {
        tenantId: tenant.id,
        bankAccountId: bank.id,
        content: BANK_CSV,
        actorUserId: owner.id,
        actorName: owner.name,
        now: new Date("2026-09-16T09:00:00Z"),
      })
    );
    expect(again.newBankLineCount).toBe(0);

    const rerun = await tx((d) => getReconciliationRun(d, tenant.id, again.reconciliationRunId));
    const reopened = rerun!.variances.filter((v) => v.status === "open");
    const board = await tx((d) => buildOwnerBoard(d, tenant.id, owner.id, asOfNow));
    expect({
      rerunStatus: rerun!.status,
      reopenedOpenVariances: reopened.map((v) => `${v.kind} ${v.amountCents}`),
      boardHeadline: board.yesterday.headline,
      boardWhy: board.yesterday.why,
    }).toMatchObject({ reopenedOpenVariances: [], boardHeadline: expect.not.stringMatching(/variance/) });
  });
});
