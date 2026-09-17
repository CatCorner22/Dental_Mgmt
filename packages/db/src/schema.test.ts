import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { baaIsLive, canEnableIntegration, refuseEnabledWithoutBaa } from "./baa";
import { encryptSecret, decryptSecret } from "./crypto";
import { GENESIS_HASH, hashDomainEvent } from "./chain";
import { uuidv7 } from "./ids";
import { DB_ROLES, PROCESS_ROLES } from "./roles";
import { SET_LOCAL_TENANT_SQL } from "./tenant-context";
import { TENANT_SCOPED_TABLES } from "./schema";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "../migrations/0001_init.sql"), "utf8");
const authSql = readFileSync(join(here, "../migrations/0002_auth_lookup.sql"), "utf8");
const auditSql = readFileSync(join(here, "../migrations/0006_audit_chain_checks.sql"), "utf8");
const complianceSql = readFileSync(join(here, "../migrations/0007_disclosures_recovery.sql"), "utf8");
const anchorSql = readFileSync(join(here, "../migrations/0008_chain_head_anchor.sql"), "utf8");
const patientsSql = readFileSync(join(here, "../migrations/0009_patients_accounts.sql"), "utf8");
const ledgerSql = readFileSync(join(here, "../migrations/0010_ledger_core.sql"), "utf8");
const ledgerViewsSql = readFileSync(join(here, "../migrations/0011_ledger_views.sql"), "utf8");
const controlsSql = readFileSync(join(here, "../migrations/0012_controls.sql"), "utf8");
const controlsRiskSql = readFileSync(join(here, "../migrations/0013_controls_risk.sql"), "utf8");
const enforcementSql = readFileSync(join(here, "../migrations/0014_controls_enforcement.sql"), "utf8");
const importSql = readFileSync(join(here, "../migrations/0015_import_staging.sql"), "utf8");
const bankSql = readFileSync(join(here, "../migrations/0016_bank_reconciliation.sql"), "utf8");
const dayCloseSql = readFileSync(join(here, "../migrations/0017_day_close_deposits.sql"), "utf8");
const statementsSql = readFileSync(join(here, "../migrations/0018_statements.sql"), "utf8");
const controlFindingsSql = readFileSync(join(here, "../migrations/0019_control_findings.sql"), "utf8");
const ledgerFindingsSql = readFileSync(join(here, "../migrations/0020_control_findings_ledger.sql"), "utf8");
const coverageFindingsSql = readFileSync(join(here, "../migrations/0021_control_findings_coverage.sql"), "utf8");
const decisionSubjectsSql = readFileSync(join(here, "../migrations/0022_control_decisions_detector_finding.sql"), "utf8");
const decisionRetireSql = readFileSync(join(here, "../migrations/0023_control_decisions_retire.sql"), "utf8");
const increment01TenantTables = [
  "locations",
  "users",
  "sessions",
  "user_entitlements",
  "domain_event",
  "phi_access_log",
  "integration_registry",
  "auth_throttle",
] as const;

describe("Increment 0.1 schema", () => {
  it("names the three process roles", () => {
    expect(PROCESS_ROLES).toEqual(["app_rw", "app_append", "app_migrate"]);
    for (const role of PROCESS_ROLES) expect(Object.keys(DB_ROLES)).toContain(role);
    expect(sql).toMatch(/app_rw/);
    expect(sql).toMatch(/app_append/);
    expect(sql).toMatch(/app_migrate/);
  });

  it("creates every Increment 0.1 table", () => {
    for (const name of [
      "tenants",
      "locations",
      "users",
      "sessions",
      "user_entitlements",
      "domain_event",
      "phi_access_log",
      "integration_registry",
      "auth_throttle",
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${name}\\b`));
    }
  });

  it("does not create clinical encounter tables in Increment 0.1", () => {
    expect(sql).not.toMatch(/CREATE TABLE encounters\b/);
    expect(sql).not.toMatch(/CREATE TABLE notes\b/);
  });

  it("enables and forces RLS on every tenant-scoped table from Increment 0.1", () => {
    for (const name of ["tenants", ...increment01TenantTables]) {
      expect(sql, name).toMatch(new RegExp(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`));
      expect(sql, name).toMatch(new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`));
    }
  });
});

describe("Increment 0.5 audit chain checks", () => {
  it("creates an append-only daily check table with RLS", () => {
    expect(auditSql).toMatch(/CREATE TABLE audit_chain_checks/);
    expect(auditSql).toMatch(/ALTER TABLE audit_chain_checks ENABLE ROW LEVEL SECURITY/);
    expect(auditSql).toMatch(/audit_chain_checks_immutable/);
    expect(auditSql).toMatch(/GRANT INSERT ON audit_chain_checks TO app_append/);
  });
});

describe("Increment 0.6 disclosures and recovery", () => {
  it("creates append-only disclosures and a two-admin recovery table", () => {
    expect(complianceSql).toMatch(/CREATE TABLE disclosures/);
    expect(complianceSql).toMatch(/CREATE TABLE recovery_ceremonies/);
    expect(complianceSql).toMatch(/recovery_ceremonies_distinct_admins/);
    expect(complianceSql).toMatch(/auth_lookup_recovery_ceremony/);
    expect(complianceSql).toMatch(/GRANT INSERT ON disclosures TO app_append/);
  });
});

describe("Increment 1.1 ledger kernel", () => {
  it("creates patient headers and append-only ledger tables", () => {
    expect(patientsSql).toMatch(/CREATE TABLE patients\b/);
    expect(patientsSql).toMatch(/CREATE TABLE guarantor_accounts\b/);
    expect(ledgerSql).toMatch(/CREATE TABLE ledger_entries\b/);
    expect(ledgerSql).toMatch(/CREATE TABLE payment_allocations\b/);
    expect(ledgerSql).toMatch(/ledger_entries_immutable/);
    expect(ledgerSql).toMatch(/payment_allocations_within_bounds/);
    expect(ledgerSql).toMatch(/GRANT INSERT ON ledger_entries, payment_allocations TO app_append/);
    expect(ledgerSql).toMatch(/GRANT SELECT ON ledger_entries, payment_allocations TO app_append/);
    expect(ledgerViewsSql).toMatch(/CREATE OR REPLACE VIEW account_balances/);
    expect(ledgerViewsSql).toMatch(/CREATE OR REPLACE VIEW ledger_explanations/);
  });
});

describe("Increment 1.2 controls inbox", () => {
  it("creates policy and approval tables with immutability grants", () => {
    expect(controlsSql).toMatch(/CREATE TABLE control_policies\b/);
    expect(controlsSql).toMatch(/CREATE TABLE approval_requests\b/);
    expect(controlsSql).toMatch(/CREATE TABLE approvals_log\b/);
    expect(controlsSql).toMatch(/approval_requester_ne_second/);
    expect(controlsSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON approval_requests TO app_rw/);
  });
});

describe("Increment 1.12 Precog on live rows", () => {
  it("creates findings, an append-only decision register, and append-only snapshots", () => {
    expect(controlsRiskSql).toMatch(/CREATE TABLE sod_findings\b/);
    expect(controlsRiskSql).toMatch(/CREATE TABLE control_decisions\b/);
    expect(controlsRiskSql).toMatch(/CREATE TABLE control_snapshots\b/);
    expect(controlsRiskSql).toMatch(/UNIQUE \(tenant_id, rule_id, person_id\)/);
    expect(controlsRiskSql).toMatch(/control_decisions_immutable/);
    expect(controlsRiskSql).toMatch(/control_snapshots_immutable/);
    expect(controlsRiskSql).toMatch(/sod_findings_no_delete/);
    expect(controlsRiskSql).toMatch(/length\(btrim\(note\)\) >= 10/);
    expect(controlsRiskSql).toMatch(/ADD COLUMN decision_id uuid REFERENCES control_decisions\(id\)/);
    expect(controlsRiskSql).toMatch(
      /CREATE UNIQUE INDEX user_entitlements_live_uidx\s+ON user_entitlements \(tenant_id, user_id, entitlement\)\s+WHERE effective_to IS NULL/
    );
  });

  it("forces RLS and grants only what the runtime role needs", () => {
    for (const name of ["sod_findings", "control_decisions", "control_snapshots"]) {
      expect(controlsRiskSql, name).toMatch(new RegExp(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`));
      expect(controlsRiskSql, name).toMatch(new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`));
      expect(controlsRiskSql, name).toMatch(new RegExp(`CREATE POLICY ${name}_isolation ON ${name}`));
    }
    expect(controlsRiskSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON sod_findings TO app_rw/);
    expect(controlsRiskSql).toMatch(/GRANT SELECT, INSERT ON control_decisions TO app_rw/);
    expect(controlsRiskSql).toMatch(/GRANT SELECT, INSERT ON control_snapshots TO app_rw/);
    expect(controlsRiskSql).not.toMatch(/GRANT[^\n]*(UPDATE|DELETE)[^\n]*control_decisions/);
    expect(controlsRiskSql).not.toMatch(/GRANT[^\n]*(UPDATE|DELETE)[^\n]*control_snapshots/);
  });
});

describe("Increment 1.22 detector findings", () => {
  it("creates control_findings as open-or-closed rows that are never deleted", () => {
    expect(controlFindingsSql).toMatch(/CREATE TABLE control_findings\b/);
    expect(controlFindingsSql).toMatch(/kind IN \('unmatched_bank_line_48h', 'degraded_owner_clearance', 'decision_unreviewed'\)/);
    expect(controlFindingsSql).toMatch(/UNIQUE \(tenant_id, kind, subject_kind, subject_id\)/);
    expect(controlFindingsSql).toMatch(/control_findings_closed_has_time/);
    expect(controlFindingsSql).toMatch(/control_findings_closed_has_reason/);
    expect(controlFindingsSql).toMatch(/control_findings_no_delete/);
    expect(controlFindingsSql).toMatch(/ALTER TABLE control_findings ENABLE ROW LEVEL SECURITY/);
    expect(controlFindingsSql).toMatch(/ALTER TABLE control_findings FORCE ROW LEVEL SECURITY/);
    expect(controlFindingsSql).toMatch(/CREATE POLICY control_findings_isolation ON control_findings/);
    expect(controlFindingsSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON control_findings TO app_rw/);
    expect(controlFindingsSql).not.toMatch(/GRANT[^\n]*DELETE[^\n]*control_findings/);
    expect(TENANT_SCOPED_TABLES).toContain("control_findings");
  });

  it("widens the finding kinds to the ledger detectors and adds the ledger entry as a subject", () => {
    expect(ledgerFindingsSql).toMatch(/DROP CONSTRAINT control_findings_kind_check/);
    expect(ledgerFindingsSql).toMatch(/'release_without_approval', 'backdated_posting', 'duplicate_patient_payment'/);
    expect(ledgerFindingsSql).toMatch(/DROP CONSTRAINT control_findings_subject_kind_check/);
    expect(ledgerFindingsSql).toMatch(/'control_decision', 'ledger_entry'\)/);
    expect(ledgerFindingsSql).not.toMatch(/GRANT|DROP TABLE|DELETE/);
  });

  it("adds the coverage detectors' kinds and the deposit and entitlement subjects", () => {
    expect(coverageFindingsSql).toMatch(/'deposit_not_banked', 'sole_holder_critical_duty'/);
    expect(coverageFindingsSql).toMatch(/'ledger_entry', 'deposit', 'entitlement'\)/);
    expect(coverageFindingsSql).not.toMatch(/GRANT|DROP TABLE|DELETE/);
  });

  it("lets a control decision name a detector finding as its subject", () => {
    expect(decisionSubjectsSql).toMatch(/DROP CONSTRAINT control_decisions_subject_kind_check/);
    expect(decisionSubjectsSql).toMatch(/'scenario', 'knowledge', 'detector_finding'\)/);
    expect(decisionSubjectsSql).not.toMatch(/GRANT|DROP TABLE|DELETE|UPDATE/);
  });

  it("lets a decision be retired by a superseding row of kind retire", () => {
    expect(decisionRetireSql).toMatch(/DROP CONSTRAINT control_decisions_kind_check/);
    expect(decisionRetireSql).toMatch(/'monitor', 'insure', 'retire'\)/);
    expect(decisionRetireSql).not.toMatch(/GRANT|DROP TABLE|DELETE|UPDATE/);
  });
});

describe("Increment 1.13 dual release re-checked by the database", () => {
  it("adds a BEFORE INSERT trigger on ledger_entries that reads the active policy", () => {
    expect(enforcementSql).toMatch(/CREATE TRIGGER ledger_entries_dual_release\s+BEFORE INSERT ON ledger_entries/);
    expect(enforcementSql).toMatch(/FROM control_policies\s+WHERE tenant_id = NEW\.tenant_id\s+ORDER BY version DESC/);
    expect(enforcementSql).toMatch(/req\.status <> 'approved'/);
    expect(enforcementSql).toMatch(/req\.second_approver_id = NEW\.created_by_id/);
    expect(enforcementSql).toMatch(/ADD COLUMN applied_exception_id text/);
    expect(enforcementSql).toMatch(/CREATE UNIQUE INDEX ledger_entries_approval_request_uidx/);
    expect(enforcementSql).toMatch(/GRANT SELECT ON control_policies, approval_requests TO app_append/);
    expect(enforcementSql).not.toMatch(/GRANT[^\n]*(INSERT|UPDATE|DELETE)[^\n]*TO app_append/);
  });
});

describe("Increment 1.3 Curve Hero import staging", () => {
  it("creates import run and staged row tables with RLS", () => {
    expect(importSql).toMatch(/CREATE TABLE import_runs\b/);
    expect(importSql).toMatch(/CREATE TABLE import_staged_rows\b/);
    expect(importSql).toMatch(/ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY/);
    expect(importSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON import_runs, import_staged_rows TO app_rw/);
  });
});

describe("Increment 1.5 bank reconciliation", () => {
  it("creates bank accounts, append-only transactions, and reconciliation tables", () => {
    expect(bankSql).toMatch(/CREATE TABLE bank_accounts\b/);
    expect(bankSql).toMatch(/CREATE TABLE bank_transactions\b/);
    expect(bankSql).toMatch(/CREATE TABLE reconciliation_runs\b/);
    expect(bankSql).toMatch(/CREATE TABLE reconciliation_variances\b/);
    expect(bankSql).toMatch(/bank_transactions_immutable/);
    expect(bankSql).toMatch(/GRANT SELECT, INSERT ON bank_transactions TO app_rw/);
  });
});

describe("Increment 1.6 day close and deposits", () => {
  it("creates deposits and frozen day close tables", () => {
    expect(dayCloseSql).toMatch(/CREATE TABLE deposits\b/);
    expect(dayCloseSql).toMatch(/CREATE TABLE day_closes\b/);
    expect(dayCloseSql).toMatch(/day_closes_immutable_when_frozen/);
    expect(dayCloseSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON deposits, day_closes TO app_rw/);
  });
});

describe("Increment 1.10 patient statements", () => {
  it("creates statements with issued-row immutability and RLS", () => {
    expect(statementsSql).toMatch(/CREATE TABLE statements\b/);
    expect(statementsSql).toMatch(/hold_reason/);
    expect(statementsSql).toMatch(/statements_immutable_when_issued/);
    expect(statementsSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON statements TO app_rw/);
    expect(TENANT_SCOPED_TABLES).toContain("statements");
  });
});

describe("Increment 0.7 chain head anchor", () => {
  it("stores the Object Lock key and allows a one-time anchor update", () => {
    expect(anchorSql).toMatch(/object_lock_key/);
    expect(anchorSql).toMatch(/GRANT SELECT, UPDATE ON audit_chain_checks TO app_append/);
    expect(anchorSql).toMatch(/OLD\.object_lock_key IS NULL/);
  });
});

describe("BAA gate", () => {
  const live = {
    signedAt: new Date("2026-01-01T00:00:00Z"),
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    documentRef: "baa/vendor-1",
  };

  it("refuses enablement without a live BAA", () => {
    expect(canEnableIntegration({ signedAt: null, expiresAt: null, documentRef: null })).toBe(
      false
    );
    expect(refuseEnabledWithoutBaa(true, live).ok).toBe(true);
    expect(
      refuseEnabledWithoutBaa(true, { signedAt: null, expiresAt: null, documentRef: null })
    ).toEqual({ ok: false, code: "baa_required" });
  });

  it("treats an expired BAA as not live", () => {
    expect(
      baaIsLive({
        signedAt: new Date("2024-01-01T00:00:00Z"),
        expiresAt: new Date("2025-01-01T00:00:00Z"),
        documentRef: "old",
      })
    ).toBe(false);
  });

  it("is encoded in the migration trigger", () => {
    expect(sql).toMatch(/integration_requires_live_baa/);
    expect(sql).toMatch(/baa_required/);
  });
});

describe("envelope encryption", () => {
  const env = { DEV_MFA_KEY: "a".repeat(64) };

  it("round-trips an MFA secret", () => {
    const blob = encryptSecret("JBSWY3DPEHPK3PXP", env);
    expect(blob.alg).toBe("aes-256-gcm");
    expect(decryptSecret(blob, env)).toBe("JBSWY3DPEHPK3PXP");
  });
});

describe("domain event chain", () => {
  it("is deterministic and breaks if a link is rewritten", () => {
    const first = hashDomainEvent({
      prevHash: GENESIS_HASH,
      tenantId: "t1",
      kind: "user.created",
      payload: { id: "u1" },
      occurredAt: "2026-09-14T00:00:00.000Z",
    });
    const second = hashDomainEvent({
      prevHash: first,
      tenantId: "t1",
      kind: "session.started",
      payload: { id: "s1" },
      occurredAt: "2026-09-14T00:01:00.000Z",
    });
    expect(first).toHaveLength(64);
    expect(second).not.toBe(first);
    const tampered = hashDomainEvent({
      prevHash: first,
      tenantId: "t1",
      kind: "session.started",
      payload: { id: "s2" },
      occurredAt: "2026-09-14T00:01:00.000Z",
    });
    expect(tampered).not.toBe(second);
  });
});

describe("uuidv7", () => {
  it("is time-ordered", () => {
    const a = uuidv7(1_000);
    const b = uuidv7(2_000);
    expect(a < b).toBe(true);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

describe("Increment 0.2 auth lookup", () => {
  it("binds tenant context with SET LOCAL (is_local true)", () => {
    expect(SET_LOCAL_TENANT_SQL).toMatch(/set_config\('app\.tenant_id', \$1, true\)/);
    expect(SET_LOCAL_TENANT_SQL).toMatch(/set_config\('app\.user_id', \$2, true\)/);
  });

  it("looks up users and sessions without a tenant setting", () => {
    expect(authSql).toMatch(/CREATE OR REPLACE FUNCTION auth_lookup_user\(/);
    expect(authSql).toMatch(/CREATE OR REPLACE FUNCTION auth_lookup_user_by_id\(/);
    expect(authSql).toMatch(/CREATE OR REPLACE FUNCTION auth_lookup_session\(/);
    expect(authSql).toMatch(/SECURITY DEFINER/);
    expect(authSql).toMatch(/users_username_lower_uidx/);
  });
});
