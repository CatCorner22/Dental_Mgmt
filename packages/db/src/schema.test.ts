import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TENANT_SCOPED_TABLES } from "./schema";
import { baaIsLive, canEnableIntegration, refuseEnabledWithoutBaa } from "./baa";
import { encryptSecret, decryptSecret } from "./crypto";
import { GENESIS_HASH, hashDomainEvent } from "./chain";
import { uuidv7 } from "./ids";
import { DB_ROLES } from "./roles";
import { SET_LOCAL_TENANT_SQL } from "./tenant-context";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "../migrations/0001_init.sql"), "utf8");
const authSql = readFileSync(join(here, "../migrations/0002_auth_lookup.sql"), "utf8");

describe("Increment 0.1 schema", () => {
  it("names the three DB roles", () => {
    expect(Object.keys(DB_ROLES)).toEqual(["app_rw", "app_append", "app_migrate"]);
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

  it("does not create PHI patient tables", () => {
    expect(sql).not.toMatch(/CREATE TABLE patients\b/);
    expect(sql).not.toMatch(/CREATE TABLE encounters\b/);
    expect(sql).not.toMatch(/CREATE TABLE notes\b/);
  });

  it("enables and forces RLS on every tenant-scoped table", () => {
    for (const name of ["tenants", ...TENANT_SCOPED_TABLES]) {
      expect(sql, name).toMatch(new RegExp(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`));
      expect(sql, name).toMatch(new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`));
    }
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
