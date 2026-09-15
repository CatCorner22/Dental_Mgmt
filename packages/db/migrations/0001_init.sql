-- Increment 0.1 foundation schema. No PHI patient rows.
-- Applied by drizzle-kit / the migrate runner. One transaction per file.

CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL
);

CREATE TABLE locations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  timezone text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);
CREATE INDEX locations_tenant_idx ON locations (tenant_id);
CREATE UNIQUE INDEX locations_tenant_name_uidx ON locations (tenant_id, name);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  username text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  clinical_role text NOT NULL DEFAULT 'unset',
  active boolean NOT NULL DEFAULT true,
  mfa_secret_enc jsonb NOT NULL,
  mfa_enrolled_at timestamptz,
  recovery_codes_hash text,
  password_changed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX users_tenant_idx ON users (tenant_id);
CREATE UNIQUE INDEX users_tenant_username_uidx ON users (tenant_id, username);

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  device_profile text NOT NULL DEFAULT 'desk',
  revoked_at timestamptz,
  user_agent text
);
CREATE INDEX sessions_tenant_user_idx ON sessions (tenant_id, user_id);
CREATE INDEX sessions_idle_idx ON sessions (idle_expires_at);

CREATE TABLE user_entitlements (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  entitlement text NOT NULL,
  granted_by uuid,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  reason text
);
CREATE INDEX user_entitlements_tenant_user_idx ON user_entitlements (tenant_id, user_id);

CREATE TABLE domain_event (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  actor_user_id uuid,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  occurred_at timestamptz NOT NULL
);
CREATE INDEX domain_event_tenant_occurred_idx ON domain_event (tenant_id, occurred_at);
CREATE UNIQUE INDEX domain_event_tenant_hash_uidx ON domain_event (tenant_id, hash);

CREATE TABLE phi_access_log (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  purpose text NOT NULL,
  record_kind text NOT NULL,
  record_ids jsonb NOT NULL,
  at timestamptz NOT NULL
);
CREATE INDEX phi_access_log_tenant_at_idx ON phi_access_log (tenant_id, at);

CREATE TABLE integration_registry (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  vendor text NOT NULL,
  purpose text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  baa_signed_at timestamptz,
  baa_expires_at timestamptz,
  baa_document_ref text,
  created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX integration_registry_tenant_vendor_uidx
  ON integration_registry (tenant_id, vendor, purpose);

CREATE TABLE auth_throttle (
  key text PRIMARY KEY,
  tenant_id uuid,
  fail_count integer NOT NULL DEFAULT 0,
  first_fail_at timestamptz NOT NULL,
  locked_until timestamptz
);

-- BAA gate: enabled requires a signed, referenced, unexpired BAA.
CREATE OR REPLACE FUNCTION integration_requires_live_baa()
RETURNS trigger AS $$
BEGIN
  IF NEW.enabled THEN
    IF NEW.baa_signed_at IS NULL OR NEW.baa_document_ref IS NULL OR btrim(NEW.baa_document_ref) = '' THEN
      RAISE EXCEPTION 'baa_required'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.baa_expires_at IS NOT NULL AND NEW.baa_expires_at <= now() THEN
      RAISE EXCEPTION 'baa_required'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integration_registry_baa_gate
  BEFORE INSERT OR UPDATE ON integration_registry
  FOR EACH ROW EXECUTE FUNCTION integration_requires_live_baa();

-- Row-level security. The app connects as a non-owner role so these hold.
-- current_setting('app.tenant_id') is set per transaction by withGuard.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE phi_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_throttle ENABLE ROW LEVEL SECURITY;

ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE user_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE domain_event FORCE ROW LEVEL SECURITY;
ALTER TABLE phi_access_log FORCE ROW LEVEL SECURITY;
ALTER TABLE integration_registry FORCE ROW LEVEL SECURITY;
ALTER TABLE auth_throttle FORCE ROW LEVEL SECURITY;

CREATE POLICY tenants_isolation ON tenants
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY locations_isolation ON locations
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY users_isolation ON users
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY sessions_isolation ON sessions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY user_entitlements_isolation ON user_entitlements
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY domain_event_isolation ON domain_event
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY phi_access_log_isolation ON phi_access_log
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY integration_registry_isolation ON integration_registry
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY auth_throttle_isolation ON auth_throttle
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

-- Role documentation (not created here — local compose uses one role until vault).
-- app_rw:      runtime, no BYPASSRLS, not owner
-- app_append:  INSERT-only on domain_event, phi_access_log, and later ledger tables
-- app_migrate: applies this file
