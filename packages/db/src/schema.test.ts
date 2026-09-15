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
const importSql = readFileSync(join(here, "../migrations/0013_import_staging.sql"), "utf8");
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

describe("Increment 1.3 Curve Hero import staging", () => {
  it("creates import run and staged row tables with RLS", () => {
    expect(importSql).toMatch(/CREATE TABLE import_runs\b/);
    expect(importSql).toMatch(/CREATE TABLE import_staged_rows\b/);
    expect(importSql).toMatch(/ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY/);
    expect(importSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON import_runs, import_staged_rows TO app_rw/);
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
