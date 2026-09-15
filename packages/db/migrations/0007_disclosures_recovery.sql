-- Increment 0.6: accounting-of-disclosures schema and two-admin recovery.

CREATE TABLE disclosures (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  patient_id uuid NOT NULL,
  at timestamptz NOT NULL,
  channel text NOT NULL,
  recipient text NOT NULL,
  record_ids jsonb NOT NULL,
  purpose text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id),
  actor_name text NOT NULL,
  document_id uuid
);

CREATE INDEX disclosures_tenant_patient_at_idx ON disclosures (tenant_id, patient_id, at);

ALTER TABLE disclosures ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosures FORCE ROW LEVEL SECURITY;

CREATE POLICY disclosures_isolation ON disclosures
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION disclosures_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'disclosures is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER disclosures_no_update
  BEFORE UPDATE ON disclosures
  FOR EACH ROW EXECUTE FUNCTION disclosures_immutable();

CREATE TRIGGER disclosures_no_delete
  BEFORE DELETE ON disclosures
  FOR EACH ROW EXECUTE FUNCTION disclosures_immutable();

GRANT SELECT, INSERT ON disclosures TO app_rw;
GRANT INSERT ON disclosures TO app_append;

CREATE TABLE recovery_ceremonies (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  target_user_id uuid NOT NULL REFERENCES users(id),
  initiated_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  initiated_at timestamptz NOT NULL,
  approved_at timestamptz,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  reset_token_hash text,
  CONSTRAINT recovery_ceremonies_distinct_admins
    CHECK (approved_by IS NULL OR initiated_by <> approved_by)
);

CREATE INDEX recovery_ceremonies_target_idx ON recovery_ceremonies (tenant_id, target_user_id, initiated_at DESC);

ALTER TABLE recovery_ceremonies ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_ceremonies FORCE ROW LEVEL SECURITY;

CREATE POLICY recovery_ceremonies_isolation ON recovery_ceremonies
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON recovery_ceremonies TO app_rw;

-- Password reset consumes a ceremony before tenant context exists.
CREATE OR REPLACE FUNCTION auth_lookup_recovery_ceremony(p_id uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  target_user_id uuid,
  initiated_by uuid,
  approved_by uuid,
  initiated_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz,
  reset_token_hash text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.tenant_id, c.target_user_id, c.initiated_by, c.approved_by,
         c.initiated_at, c.approved_at, c.expires_at, c.consumed_at, c.reset_token_hash
    FROM recovery_ceremonies c
   WHERE c.id = p_id;
$$;

ALTER FUNCTION auth_lookup_recovery_ceremony(uuid) OWNER TO app_auth_lookup;
REVOKE EXECUTE ON FUNCTION auth_lookup_recovery_ceremony(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_recovery_ceremony(uuid) TO app_rw;
