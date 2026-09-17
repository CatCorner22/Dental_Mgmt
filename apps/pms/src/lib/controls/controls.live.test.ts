import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { uuidv7 } from "@pms/db";
import { verifyDatabaseChains } from "@pms/verifier";
import { evaluateRelease } from "@pms/controls-engine";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { createApprovalRequest, getApprovalRequest } from "./approvals";
import { approveAndPost } from "./decideAndPost";
import { recordDecision } from "./decisions";
import { snapshotAllTenants } from "./nightly";
import { loadStaff } from "./staff";
import { addException, listExceptions, retireException } from "./exceptions";
import { listFindings } from "./findings";
import { grantEntitlement, revokeEntitlement } from "./grants";
import { seedControlPolicy } from "./policy";
import { loadControlsContext } from "./practiceState";
import { attestChannelRelease } from "./release";
import { computeSnapshot, latestSnapshot, takeSnapshot } from "./snapshots";

/**
 * Precog on live rows, exercised end to end as app_rw against a throwaway
 * database: grants refused and licensed inside one transaction, findings
 * upserted, decisions appended, exceptions versioned, releases recorded,
 * snapshots frozen, and the chain still verifying afterwards.
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(10_000), name: "Ridgeview Family Dental", slug: "ridgeview" };
const other = { id: uuidv7(10_500), name: "Oakridge Dental", slug: "oakridge" };
const owner = { id: uuidv7(10_001), username: "ridgeview-owner", name: "Riley Owner", role: "admin" };
const secondAdmin = { id: uuidv7(10_002), username: "ridgeview-partner", name: "Pat Partner", role: "admin" };
const om = { id: uuidv7(10_003), username: "ridgeview-om", name: "Maya Chen", role: "user" };
const front = { id: uuidv7(10_004), username: "ridgeview-front", name: "Jordan Blake", role: "user" };
const otherOwner = { id: uuidv7(10_501), username: "oakridge-owner", name: "Oak Owner", role: "admin" };

const seedGrants: [typeof om, string][] = [
  [owner, "approve_writeoffs"],
  [owner, "approve_vendor"],
  [owner, "pms_admin_roles"],
  // The office manager also holds cash: with the deposit channel enforced,
  // posting + reconciliation (rule-cash-rec) is a mitigated critical, so the
  // unmitigated critical these cases exercise is custody + reconciliation.
  [om, "post_payments"],
  [om, "prepare_deposit"],
  [om, "post_adjustments"],
  [om, "collect_cash"],
  [front, "collect_cash"],
  [front, "post_payments"],
];

const asOwner = { id: owner.id, name: owner.name };
const asOm = { id: om.id, name: om.name };
const reviewBy = "2026-12-31";
const note = "Owner reconciles the bank personally every Friday until a bookkeeper is engaged.";

describe.skipIf(!adminUrl)("Precog controls (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  let verifier: Client;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as = asOwner, tenantId = tenant.id) {
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
    verifier = new Client({ connectionString: await db.loginAs("app_verify") });
    await verifier.connect();

    for (const t of [tenant, other]) {
      await db.admin.query("INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())", [
        t.id,
        t.name,
        t.slug,
      ]);
    }
    const users = [
      [tenant.id, owner],
      [tenant.id, secondAdmin],
      [tenant.id, om],
      [tenant.id, front],
      [other.id, otherOwner],
    ] as const;
    for (const [tenantId, u] of users) {
      await db.admin.query(
        `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, clinical_role,
                            mfa_enrolled_at, password_changed_at, created_at)
         VALUES ($1, $2, $3, $4, 'x', $5, 'unset', now(), now(), now() - interval '2 years')`,
        [u.id, tenantId, u.username, u.name, u.role]
      );
    }
    for (const [u, entitlement] of seedGrants) {
      await db.admin.query(
        `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
         VALUES ($1, $2, $3, $4, now())`,
        [uuidv7(), tenant.id, u.id, entitlement]
      );
    }
    await tx((d) => seedControlPolicy(d, { tenantId: tenant.id, createdById: owner.id, createdByName: owner.name }));
  }, 60_000);

  afterAll(async () => {
    await verifier?.end();
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("builds the practice state from live rows and derives staff composition", async () => {
    const ctx = await tx((d) => loadControlsContext(d, tenant.id));
    expect(ctx.active?.version).toBe(1);
    expect(ctx.built.state.staff.teamSize).toBe(4);
    // ACH and check are partial (patient refunds and transfers only); the
    // deposit channel is enforced at the day-close seal, so it earns the credit.
    expect(ctx.built.state.staff.dualControlPayments).toBe(true);
    expect(ctx.built.coverage.find((c) => c.channel === "deposit")?.status).toBe("enforced");
    expect(ctx.built.state.staff.independentBankRec).toBe(false);
    expect(ctx.built.state.staff.segregationScore).toBe(ctx.built.sod.summary.segregationHealth);
    // Office manager: deposit + posting + cash; front desk: cash + posting.
    // Both pairs are high, not critical, and the enforced deposit channel mitigates them.
    expect(ctx.built.sod.conflicts.map((c) => c.ruleId)).toEqual(
      expect.arrayContaining(["rule-deposit-post", "rule-collect-post"])
    );
    const cashPairs = ctx.built.sod.conflicts.filter((c) => ["rule-deposit-post", "rule-collect-post"].includes(c.ruleId));
    expect(cashPairs.length).toBeGreaterThanOrEqual(2);
    expect(cashPairs.every((c) => c.dualReleaseMitigated)).toBe(true);
    expect(ctx.built.coverage.find((c) => c.channel === "payroll")?.status).toBe("external");
  });

  it("refuses a grant that creates an unmitigated critical conflict and writes nothing", async () => {
    const result = await tx((d) =>
      grantEntitlement(d, { tenantId: tenant.id, actor: asOwner, targetUserId: om.id, entitlement: "bank_reconcile" })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
    expect(result.code).toBe("sod_critical_conflict");
    expect(result.conflicts?.map((c) => c.ruleId)).toContain("rule-custody-rec");
    expect(result.nextSteps[0]).toMatch(/control decision/);

    const { rows } = await db.admin.query(
      "SELECT 1 FROM user_entitlements WHERE user_id = $1 AND entitlement = 'bank_reconcile'",
      [om.id]
    );
    expect(rows).toEqual([]);
    const events = await db.admin.query("SELECT kind FROM domain_event WHERE tenant_id = $1", [tenant.id]);
    expect(events.rows.map((r) => r.kind)).not.toContain("role.granted");
  });

  it("refuses an unknown entitlement and a decision that does not license the grant", async () => {
    const unknown = await tx((d) =>
      grantEntitlement(d, { tenantId: tenant.id, actor: asOwner, targetUserId: om.id, entitlement: "write_off" })
    );
    expect(unknown).toMatchObject({ ok: false, status: 400, code: "unknown_entitlement" });

    const monitorOnly = await tx((d) =>
      grantEntitlement(d, {
        tenantId: tenant.id,
        actor: asOwner,
        targetUserId: om.id,
        entitlement: "bank_reconcile",
        decision: { kind: "monitor", note, reviewBy },
      })
    );
    expect(monitorOnly).toMatchObject({ ok: false, status: 400, code: "decision_invalid" });
  });

  it("refuses an administrator licensing their own critical conflict", async () => {
    // The office manager is promoted to admin for this case only.
    await db.admin.query("UPDATE users SET role = 'admin' WHERE id = $1", [om.id]);
    try {
      const self = await tx(
        (d) =>
          grantEntitlement(d, {
            tenantId: tenant.id,
            actor: asOm,
            targetUserId: om.id,
            entitlement: "bank_reconcile",
            decision: { kind: "accept_residual", note, reviewBy },
          }),
        asOm
      );
      expect(self).toMatchObject({ ok: false, status: 403, code: "self_grant_requires_second_admin" });
    } finally {
      await db.admin.query("UPDATE users SET role = 'user' WHERE id = $1", [om.id]);
    }
  });

  it("grants with a licensing decision, links the grant to it, and refreshes the findings", async () => {
    const result = await tx((d) =>
      grantEntitlement(d, {
        tenantId: tenant.id,
        actor: asOwner,
        targetUserId: om.id,
        entitlement: "bank_reconcile",
        reason: "Bookkeeper left; interim cover.",
        decision: { kind: "accept_residual", note, reviewBy },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.requiresDecision).toBe(true);
    expect(result.decisionIds.length).toBeGreaterThanOrEqual(1);
    expect(result.findings.inserted).toBeGreaterThan(0);

    const grant = await db.admin.query(
      "SELECT decision_id, granted_by, reason FROM user_entitlements WHERE id = $1",
      [result.grantId]
    );
    expect(grant.rows[0]).toEqual({
      decision_id: result.decisionIds[0],
      granted_by: owner.id,
      reason: "Bookkeeper left; interim cover.",
    });

    const decisions = await db.admin.query(
      "SELECT subject_kind, subject_id, kind, review_by::text AS review_by FROM control_decisions WHERE tenant_id = $1 ORDER BY decided_at",
      [tenant.id]
    );
    expect(decisions.rows).toEqual(
      expect.arrayContaining([
        { subject_kind: "sod_finding", subject_id: `${om.id}:rule-custody-rec`, kind: "accept_residual", review_by: reviewBy },
      ])
    );

    const findings = await tx((d) => listFindings(d, tenant.id));
    const custodyRec = findings.find((f) => f.ruleId === "rule-custody-rec" && f.personId === om.id);
    expect(custodyRec).toMatchObject({ status: "open", severity: "critical", residualRiskAccepted: true });

    const events = await db.admin.query(
      "SELECT kind FROM domain_event WHERE tenant_id = $1 ORDER BY seq",
      [tenant.id]
    );
    expect(events.rows.map((r) => r.kind)).toContain("role.granted");
    const verdict = await verifyDatabaseChains(verifier);
    expect(verdict.tenants.find((t) => t.tenantId === tenant.id)?.publish).toBe(true);
  });

  it("serializes concurrent grants so a critical pair cannot slip through together", async () => {
    // Two administrators grant the two halves of rule-custody-rec to the same
    // person at the same moment. The per-tenant lock makes the second grant
    // see the first, so exactly one succeeds and the other is refused.
    const target = secondAdmin.id;
    const [a, b] = await Promise.all([
      tx((d) =>
        grantEntitlement(d, { tenantId: tenant.id, actor: asOwner, targetUserId: target, entitlement: "collect_cash" })
      ),
      tx(
        (d) =>
          grantEntitlement(d, {
            tenantId: tenant.id,
            actor: { id: front.id, name: front.name },
            targetUserId: target,
            entitlement: "bank_reconcile",
          }),
        { id: front.id, name: front.name }
      ),
    ]);
    const outcomes = [a, b];
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    const refused = outcomes.find((r) => !r.ok);
    expect(refused).toMatchObject({ ok: false, status: 403, code: "sod_critical_conflict" });

    const { rows } = await db.admin.query(
      "SELECT entitlement FROM user_entitlements WHERE user_id = $1 AND effective_to IS NULL ORDER BY entitlement",
      [target]
    );
    expect(rows).toHaveLength(1);
    // Clean up so later cases see the seeded picture.
    await db.admin.query("DELETE FROM user_entitlements WHERE user_id = $1", [target]);
    await db.admin.query("UPDATE sod_findings SET status = 'closed', closed_at = now() WHERE person_id = $1", [target]);
  });

  it("keeps one live row per grant at the database as the backstop", async () => {
    const dup = await db.admin
      .query(
        `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
         VALUES ($1, $2, $3, 'collect_cash', now())`,
        [uuidv7(), tenant.id, front.id]
      )
      .then(() => "inserted")
      .catch((e: { code?: string }) => e.code);
    expect(dup).toBe("23505");
  });

  it("refuses a duplicate grant", async () => {
    const again = await tx((d) =>
      grantEntitlement(d, { tenantId: tenant.id, actor: asOwner, targetUserId: om.id, entitlement: "bank_reconcile" })
    );
    expect(again).toMatchObject({ ok: false, status: 409, code: "already_granted" });
  });

  it("revokes, closes the finding, and reopens it on a recurrence", async () => {
    const revoked = await tx((d) =>
      revokeEntitlement(d, { tenantId: tenant.id, actor: asOwner, targetUserId: om.id, entitlement: "bank_reconcile" })
    );
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(revoked.findings.closed).toBeGreaterThan(0);
    let findings = await tx((d) => listFindings(d, tenant.id));
    let custodyRec = findings.find((f) => f.ruleId === "rule-custody-rec" && f.personId === om.id)!;
    expect(custodyRec.status).toBe("closed");
    expect(custodyRec.closedAt).not.toBeNull();

    const missing = await tx((d) =>
      revokeEntitlement(d, { tenantId: tenant.id, actor: asOwner, targetUserId: om.id, entitlement: "bank_reconcile" })
    );
    expect(missing).toMatchObject({ ok: false, status: 404, code: "grant_not_found" });

    const regrant = await tx((d) =>
      grantEntitlement(d, {
        tenantId: tenant.id,
        actor: { id: secondAdmin.id, name: secondAdmin.name },
        targetUserId: om.id,
        entitlement: "bank_reconcile",
        decision: { kind: "compensate", note, reviewBy },
      }),
      { id: secondAdmin.id, name: secondAdmin.name }
    );
    expect(regrant.ok).toBe(true);
    findings = await tx((d) => listFindings(d, tenant.id));
    custodyRec = findings.find((f) => f.ruleId === "rule-custody-rec" && f.personId === om.id)!;
    expect(custodyRec.status).toBe("open");
    expect(custodyRec.reopenedCount).toBe(1);
    expect(custodyRec.closedAt).toBeNull();
  });

  it("records a standalone decision and refuses a bare one", async () => {
    const bad = await tx((d) =>
      recordDecision(d, {
        tenantId: tenant.id,
        actor: asOwner,
        subjectKind: "control",
        subjectId: "c-cash",
        kind: "monitor",
        note: "ok",
      })
    );
    expect(bad.ok).toBe(false);
    const good = await tx((d) =>
      recordDecision(d, {
        tenantId: tenant.id,
        actor: asOwner,
        subjectKind: "control",
        subjectId: "c-cash",
        kind: "monitor",
        note: "Daily drawer report goes to the owner; camera on the drawer close.",
        reviewBy,
      })
    );
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.decision.decidedByName).toBe(owner.name);

    // Nobody licenses a conflict on their own duties through the register either.
    const selfLicence = await tx(
      (d) =>
        recordDecision(d, {
          tenantId: tenant.id,
          actor: asOm,
          subjectKind: "sod_finding",
          subjectId: `${om.id}:rule-custody-rec`,
          kind: "accept_residual",
          note: "I review my own reconciliation carefully every Friday.",
          reviewBy,
        }),
      asOm
    );
    expect(selfLicence.ok).toBe(false);
    if (selfLicence.ok) return;
    expect(selfLicence.errors[0]).toMatch(/your own duties/);
    const monitorOwn = await tx(
      (d) =>
        recordDecision(d, {
          tenantId: tenant.id,
          actor: asOm,
          subjectKind: "sod_finding",
          subjectId: `${om.id}:rule-custody-rec`,
          kind: "monitor",
          note: "Asked the owner to review; tracking until then.",
          reviewBy,
        }),
      asOm
    );
    expect(monitorOwn.ok).toBe(true);
  });

  it("versions the policy for every exception and keeps payroll external", async () => {
    const seeded = await tx((d) => listExceptions(d, tenant.id));
    // No demo exceptions in a real tenant; the after-hours hold (Increment 1.30) is the one production default.
    expect(seeded.exceptions.map((e) => [e.id, e.action, e.enabled])).toEqual([["ex-after-hours-hold", "force_dual", true]]);
    expect(seeded.summary).toMatchObject({ total: 1, forceDual: 1, raises: 0, waives: 0 });
    expect(seeded.coverage.find((c) => c.channel === "writeoff")?.activeExceptions).toBe(1);
    expect(seeded.coverage.find((c) => c.channel === "ach")?.activeExceptions).toBe(0);

    const waiver = await tx((d) =>
      addException(d, {
        tenantId: tenant.id,
        actor: asOwner,
        exception: {
          id: "ex-waive-refund",
          label: "Waive dual on processor refunds",
          channels: ["check"],
          action: "waive_dual",
          enabled: true,
          reason: "Processor-initiated refunds.",
          residualNote: "Owner samples refunds monthly.",
          createdAt: "",
        },
      })
    );
    expect(waiver).toMatchObject({ ok: false, status: 400, code: "invalid" });
    if (waiver.ok) return;
    expect(waiver.errors).toContain("A waiver must carry an effectiveTo date; waivers always expire.");

    const raise = await tx((d) =>
      addException(d, {
        tenantId: tenant.id,
        actor: asOwner,
        exception: {
          id: "ex-lab-raise",
          label: "Trusted lab ACH raise",
          channels: ["ach"],
          action: "raise_threshold",
          thresholdUsd: 3500,
          payeeContains: "apex dental lab",
          enabled: true,
          reason: "Recurring lab with twelve months of clean invoices.",
          residualNote: "Single release up to $3,500 for Apex only.",
          createdAt: "",
        },
      })
    );
    expect(raise).toMatchObject({ ok: true, policyVersion: 2 });

    let view = await tx((d) => listExceptions(d, tenant.id));
    expect(view.policyVersion).toBe(2);
    expect(view.summary.raises).toBe(1);
    expect(view.coverage.find((c) => c.channel === "ach")?.activeExceptions).toBe(1);
    expect(view.coverage.find((c) => c.channel === "payroll")).toMatchObject({
      status: "external",
      countsTowardScores: false,
    });

    const retired = await tx((d) =>
      retireException(d, { tenantId: tenant.id, actor: asOwner, exceptionId: "ex-lab-raise", reason: "Lab changed banks." })
    );
    expect(retired).toMatchObject({ ok: true, policyVersion: 3 });
    view = await tx((d) => listExceptions(d, tenant.id));
    expect(view.summary.raises).toBe(0);
    expect(view.exceptions.find((e) => e.id === "ex-lab-raise")?.enabled).toBe(false);

    const versions = await db.admin.query(
      "SELECT version FROM control_policies WHERE tenant_id = $1 ORDER BY version",
      [tenant.id]
    );
    expect(versions.rows.map((r) => r.version)).toEqual([1, 2, 3]);
  });

  it("attests a release on a channel the ledger does not carry, and never as a completed dual release", async () => {
    const payroll = await tx(
      (d) => attestChannelRelease(d, { tenantId: tenant.id, actor: asOm, channel: "payroll", amountUsd: 18000 }),
      asOm
    );
    expect(payroll.ok).toBe(true);
    if (!payroll.ok) return;
    expect(payroll.coverage.enforcement).toBe("external");
    expect(payroll.attestedBy).toBe(om.id);
    expect(payroll.evaluation.dualRequired).toBe(true);
    expect(payroll.evaluation.status).not.toBe("approved_dual");
    // Payroll always needs two people; Maya's Precog role decides whether she may even initiate it.
    expect(["needs_second", "blocked_role", "blocked_missing_second"]).toContain(payroll.evaluation.status);

    const bad = await tx((d) =>
      attestChannelRelease(d, { tenantId: tenant.id, actor: asOwner, channel: "wire", amountUsd: 10 })
    );
    expect(bad).toMatchObject({ ok: false, status: 400, code: "unknown_channel" });
    // Ledger channels are enforced or partial in postGuarded; nobody attests them by hand.
    for (const channel of ["writeoff", "check", "ach"]) {
      const ledger = await tx((d) =>
        attestChannelRelease(d, { tenantId: tenant.id, actor: asOwner, channel, amountUsd: 900 })
      );
      expect(ledger).toMatchObject({ ok: false, status: 400, code: "ledger_channel" });
    }

    const events = await db.admin.query(
      "SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = 'control.release_attested'",
      [tenant.id]
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].payload).toMatchObject({
      channel: "payroll",
      enforcement: "external",
      attestedBy: om.id,
      dualRequired: true,
    });
    expect(events.rows[0].payload.status).not.toBe("approved_dual");
  });

  it("freezes a snapshot with both versions and serves it back", async () => {
    const stored = await tx((d) => takeSnapshot(d, { tenantId: tenant.id, actor: asOwner, trigger: "manual" }));
    expect(stored.snapshot.scoringVersion).toBe("precog-residual-v1.1.0");
    expect(stored.snapshot.rulebookVersion).toBe("0.2.0");
    expect(stored.snapshot.headline.unmitigatedCritical).toBeGreaterThanOrEqual(1);
    expect(stored.snapshot.assumptions.some((a) => /Payroll transmission/.test(a))).toBe(true);

    const latest = await tx((d) => latestSnapshot(d, tenant.id));
    expect(latest?.id).toBe(stored.id);
    expect(latest?.snapshot.headline).toEqual(stored.snapshot.headline);

    const live = await tx((d) => computeSnapshot(d, tenant.id));
    expect(live.snapshot.headline.openConflicts).toBe(stored.snapshot.headline.openConflicts);

    const row = await db.admin.query(
      "SELECT average_residual, coso_overall, conflicts_without_decision FROM control_snapshots WHERE id = $1",
      [stored.id]
    );
    expect(row.rows[0]).toEqual({
      average_residual: stored.snapshot.headline.averageResidual,
      coso_overall: stored.snapshot.headline.cosoOverall,
      conflicts_without_decision: stored.snapshot.headline.conflictsWithoutDecision,
    });
  });

  it("shows another tenant nothing", async () => {
    const findings = await tx((d) => listFindings(d, other.id), { id: otherOwner.id, name: otherOwner.name }, other.id);
    expect(findings).toEqual([]);
    const snapshot = await tx((d) => latestSnapshot(d, other.id), { id: otherOwner.id, name: otherOwner.name }, other.id);
    expect(snapshot).toBeNull();
    const ctx = await tx((d) => loadControlsContext(d, other.id), { id: otherOwner.id, name: otherOwner.name }, other.id);
    expect(ctx.active).toBeNull();
    expect(ctx.built.state.staff.dualControlPayments).toBe(false);
    expect(ctx.built.sod.conflicts).toEqual([]);
  });

  describe("held posting: approve, then post, then attach", () => {
    const locationId = uuidv7(11_000);
    const patientId = uuidv7(11_001);
    const accountId = uuidv7(11_002);

    async function heldWriteOff(amountCents: number, requestAmountCents = Math.abs(amountCents)) {
      return tx(async (d) => {
        const active = (await import("./policy")).loadActivePolicy(d, tenant.id);
        const policy = (await active)!.policy;
        const { people } = await loadStaff(d, tenant.id);
        const evaluation = evaluateRelease(
          policy,
          { channel: "writeoff", amountUsd: Math.abs(amountCents) / 100, initiatorPersonId: om.id },
          people
        );
        return createApprovalRequest(d, {
          tenantId: tenant.id,
          channel: "writeoff",
          amountCents: requestAmountCents,
          heldPayload: {
            tenantId: tenant.id,
            accountId,
            patientId,
            locationId,
            kind: "write_off",
            glBucket: "patient_ar",
            amountCents,
            reasonCode: "courtesy",
            effectiveDate: "2026-09-01",
            createdById: om.id,
            createdByName: om.name,
          },
          evaluation,
          requesterId: om.id,
          requesterName: om.name,
        });
      }, asOm);
    }

    beforeAll(async () => {
      await db.admin.query(
        `INSERT INTO locations (id, tenant_id, name, timezone, created_at) VALUES ($1, $2, 'Main', 'America/Chicago', now())`,
        [locationId, tenant.id]
      );
      await tx(async (d) => {
        await d.execute(
          (await import("drizzle-orm")).sql`INSERT INTO patients (id, tenant_id, mrn, first_name, last_name, date_of_birth, primary_location_id, created_by_id, created_by_name)
           VALUES (${patientId}, ${tenant.id}, 'MRN-9', 'Pat', 'Nine', '1990-01-01', ${locationId}, ${owner.id}, 'seed')`
        );
        await d.execute(
          (await import("drizzle-orm")).sql`INSERT INTO guarantor_accounts (id, tenant_id, display_name, created_by_id, created_by_name, created_at)
           VALUES (${accountId}, ${tenant.id}, 'Pat Nine', ${owner.id}, 'seed', now())`
        );
        await d.execute(
          (await import("drizzle-orm")).sql`INSERT INTO reason_codes (tenant_id, code, kind, label) VALUES (${tenant.id}, 'courtesy', 'write_off', 'Courtesy')`
        );
      });
    });

    it("records the approval, posts with the request id, and attaches the entry", async () => {
      const request = await heldWriteOff(-30000);
      expect(request.status).toBe("pending");

      const self = await approveAndPost(tenant.id, asOm, request.id, env);
      expect(self).toMatchObject({ ok: false, status: 403, code: "same_person" });

      const result = await approveAndPost(tenant.id, asOwner, request.id, env);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const after = await tx((d) => getApprovalRequest(d, tenant.id, request.id));
      expect(after).toMatchObject({ status: "approved", secondApproverId: owner.id, resultingEntryId: result.entryId });
      const entry = await db.admin.query(
        "SELECT approval_request_id, applied_exception_id, created_by_id FROM ledger_entries WHERE id = $1",
        [result.entryId]
      );
      expect(entry.rows[0]).toEqual({ approval_request_id: request.id, applied_exception_id: null, created_by_id: om.id });

      const again = await approveAndPost(tenant.id, asOwner, request.id, env);
      expect(again).toMatchObject({ ok: false, status: 409, code: "not_pending" });
    });

    it("cancels an approval the database then refuses, with the refusal as the reason", async () => {
      // The request was raised for $200 but holds a $300 posting: the trigger refuses the mismatch.
      const request = await heldWriteOff(-30000, 20000);
      const result = await approveAndPost(tenant.id, asOwner, request.id, env);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.cancelled).toBe(true);
      expect(result.why).toMatch(/dual_release_required: approval request .* approved 20000 cents, not 30000/);

      const after = await tx((d) => getApprovalRequest(d, tenant.id, request.id));
      expect(after?.status).toBe("cancelled");
      expect(after?.decisionReason).toMatch(/approved 20000 cents/);
      const log = await db.admin.query(
        "SELECT decision FROM approvals_log WHERE request_id = $1 ORDER BY created_at",
        [request.id]
      );
      expect(log.rows.map((r) => r.decision)).toEqual(["approved", "cancelled"]);
      const entries = await db.admin.query("SELECT 1 FROM ledger_entries WHERE approval_request_id = $1", [request.id]);
      expect(entries.rows).toEqual([]);
    });
  });

  it("freezes a nightly snapshot for every tenant on the administrator's tenant list", async () => {
    const report = await snapshotAllTenants(db.admin, env, new Date());
    expect(report.failures).toEqual([]);
    expect(report.tenants.map((t) => t.tenantId).sort()).toEqual([tenant.id, other.id].sort());
    const stored = await db.admin.query(
      "SELECT tenant_id, trigger FROM control_snapshots WHERE trigger = 'nightly' ORDER BY tenant_id",
      []
    );
    expect(stored.rows.map((r) => r.tenant_id).sort()).toEqual([tenant.id, other.id].sort());
  });

  it("leaves the whole chain verifiable", async () => {
    const verdict = await verifyDatabaseChains(verifier);
    expect(verdict.publish).toBe(true);
  });
});
