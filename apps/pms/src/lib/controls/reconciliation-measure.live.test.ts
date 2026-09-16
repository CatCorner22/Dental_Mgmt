import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { seedControlPolicy } from "./policy";
import { loadControlsContext } from "./practiceState";
import { measureReconciliation } from "./reconciliationMeasure";
import { computeSnapshot } from "./snapshots";

/**
 * Independent bank reconciliation measured from live reconciliation runs,
 * as app_rw: a run cleared by someone who neither prepared deposits nor
 * posted payments in its period grades independent; a run cleared by the
 * preparer grades same hands and the snapshot says so; a tenant with no
 * cleared run in the window grades stale import. Skipped without
 * PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(30_000), name: "Ridgeview Family Dental", slug: "ridgeview-rm" };
const quiet = { id: uuidv7(30_500), name: "Quiet Dental", slug: "quiet-rm" };
const owner = { id: uuidv7(30_001), username: "rm-owner", name: "Riley Owner", role: "admin" };
const front = { id: uuidv7(30_002), username: "rm-front", name: "Jordan Blake", role: "user" };
const quietOwner = { id: uuidv7(30_501), username: "rm-quiet-owner", name: "Quinn Quiet", role: "admin" };
const location = { id: uuidv7(30_010) };
const bank = { id: uuidv7(30_020) };
const now = new Date("2026-09-16T12:00:00Z");

describe.skipIf(!adminUrl)("Independent bank reconciliation, measured (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as = owner, tenantId = tenant.id) {
    return withTenantTransaction(tenantId, as.id, fn, env);
  }

  async function insertRun(input: {
    id: string;
    periodStart: string;
    periodEnd: string;
    clearedAt: string | null;
    clearedBy: { id: string; name: string } | null;
    status?: string;
    source?: string;
    degraded?: boolean;
  }) {
    await db.admin.query(
      `INSERT INTO reconciliation_runs (id, tenant_id, bank_account_id, source, period_start, period_end, status,
                                        summary, created_at, created_by_id, created_by_name, cleared_at, cleared_by_id, cleared_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        input.id,
        tenant.id,
        bank.id,
        input.source ?? "statement_import",
        input.periodStart,
        input.periodEnd,
        input.status ?? (input.clearedAt ? "cleared" : "open"),
        JSON.stringify(input.degraded ? { degradedOwnerClearance: true } : {}),
        input.periodEnd,
        owner.id,
        owner.name,
        input.clearedAt,
        input.clearedBy?.id ?? null,
        input.clearedBy?.name ?? null,
      ]
    );
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    env = {
      POSTGRES_URL: await db.loginAs("app_rw"),
      APPEND_ROLE_DSN: await db.loginAs("app_append"),
      BCRYPT_COST: "4",
    };
    for (const t of [tenant, quiet]) {
      await db.admin.query("INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())", [t.id, t.name, t.slug]);
    }
    for (const [tenantId, u] of [
      [tenant.id, owner],
      [tenant.id, front],
      [quiet.id, quietOwner],
    ] as const) {
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, clinical_role,
                            mfa_enrolled_at, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, 'x', $5, 'unset', now(), now(), now() - interval '2 years')`,
        [u.id, tenantId, u.username, u.name, u.role]
      );
    }
    for (const [u, entitlement, tenantId] of [
      [owner, "bank_reconcile", tenant.id],
      [front, "post_payments", tenant.id],
      [front, "prepare_deposit", tenant.id],
      [front, "bank_reconcile", tenant.id],
      [quietOwner, "bank_reconcile", quiet.id],
    ] as const) {
      await db.admin.query(
        `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
         VALUES ($1, $2, $3, $4, now() - interval '1 year')`,
        [uuidv7(), tenantId, u.id, entitlement]
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
    await tx((d) => seedControlPolicy(d, { tenantId: quiet.id, createdById: quietOwner.id, createdByName: quietOwner.name }), quietOwner, quiet.id);

    // The front desk prepared a deposit in the first week of September.
    await db.admin.query(
      `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                             reference, status, prepared_by_id, prepared_by_name, created_at)
       VALUES ($1, $2, $3, $4, '2026-09-03', 'cash', 25000, 'bag-1', 'closed', $5, $6, now())`,
      [uuidv7(30_100), tenant.id, location.id, bank.id, front.id, front.name]
    );
  }, 60_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("grades stale import when nothing has been cleared in the window, and the snapshot says so", async () => {
    const m = await tx((d) => measureReconciliation(d, quiet.id, now), quietOwner, quiet.id);
    expect(m).toMatchObject({ grade: "stale_import", independentBankRec: false, clearedInWindow: 0 });
    const { snapshot } = await tx((d) => computeSnapshot(d, quiet.id, now), quietOwner, quiet.id);
    expect(snapshot.staff.independentBankRec).toBe(false);
    expect(snapshot.measurements?.reconciliation?.grade).toBe("stale_import");
    expect(snapshot.assumptions.some((a) => /not measured yet/.test(a))).toBe(false);
    expect(snapshot.assumptions.find((a) => /bank reconciliation is measured/.test(a))).toMatch(/stale import/);
  });

  it("grades independent when the owner, who neither prepared nor posted, cleared the period's run", async () => {
    await insertRun({
      id: uuidv7(30_200),
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
      clearedAt: "2026-09-08T18:00:00Z",
      clearedBy: owner,
    });
    // A run cleared before the window does not count either way.
    await insertRun({
      id: uuidv7(30_201),
      periodStart: "2026-06-01",
      periodEnd: "2026-06-07",
      clearedAt: "2026-06-08T18:00:00Z",
      clearedBy: front,
    });
    const m = await tx((d) => measureReconciliation(d, tenant.id, now));
    expect(m).toMatchObject({ grade: "independent", independentBankRec: true, clearedInWindow: 1, sameHandsInWindow: 0 });
    expect(m.latest?.clearedByName).toBe(owner.name);

    const ctx = await tx((d) => loadControlsContext(d, tenant.id, now));
    expect(ctx.built.state.staff.independentBankRec).toBe(true);
    const { snapshot } = await tx((d) => computeSnapshot(d, tenant.id, now));
    expect(snapshot.measurements?.reconciliation).toMatchObject({ grade: "independent", clearedInWindow: 1 });
    expect(snapshot.assumptions.some((a) => /bank reconciliation/.test(a))).toBe(false);
  });

  it("grades same hands once the deposit preparer clears a run covering their own deposit", async () => {
    await insertRun({
      id: uuidv7(30_202),
      periodStart: "2026-09-01",
      periodEnd: "2026-09-10",
      clearedAt: "2026-09-12T18:00:00Z",
      clearedBy: front,
    });
    const m = await tx((d) => measureReconciliation(d, tenant.id, now));
    expect(m).toMatchObject({ grade: "same_hands", independentBankRec: false, clearedInWindow: 2, sameHandsInWindow: 1, independentInWindow: 1 });
    expect(m.latest?.clearedByName).toBe(front.name);
    expect(m.why).toMatch(/1 of 2 runs .* prepared deposits or posted payments/);

    const { snapshot } = await tx((d) => computeSnapshot(d, tenant.id, now));
    expect(snapshot.staff.independentBankRec).toBe(false);
    expect(snapshot.assumptions.find((a) => /bank reconciliation is measured/.test(a))).toMatch(/same hands/);
  });

  it("counts owner-only clearance recorded as a finding as same hands", async () => {
    await insertRun({
      id: uuidv7(30_203),
      periodStart: "2026-09-11",
      periodEnd: "2026-09-14",
      clearedAt: "2026-09-15T18:00:00Z",
      clearedBy: owner,
      degraded: true,
    });
    const m = await tx((d) => measureReconciliation(d, tenant.id, now));
    expect(m).toMatchObject({ grade: "same_hands", clearedInWindow: 3, sameHandsInWindow: 2 });
    expect(m.why).toMatch(/owner-only clearance recorded as a finding/);
  });
});
