-- Increment 0.5: nightly chain verification writes one row per tenant per day.
-- The append role inserts; the verifier role may read results across tenants.

CREATE TABLE audit_chain_checks (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  day date NOT NULL,
  ok boolean NOT NULL,
  head_hash text NOT NULL,
  event_count integer NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, day)
);

CREATE INDEX audit_chain_checks_day_idx ON audit_chain_checks (day);

ALTER TABLE audit_chain_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_chain_checks FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_chain_checks_isolation ON audit_chain_checks
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY audit_chain_checks_verify ON audit_chain_checks
  FOR SELECT TO app_verify USING (true);

CREATE OR REPLACE FUNCTION audit_chain_checks_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_chain_checks is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_chain_checks_no_update
  BEFORE UPDATE ON audit_chain_checks
  FOR EACH ROW EXECUTE FUNCTION audit_chain_checks_immutable();

CREATE TRIGGER audit_chain_checks_no_delete
  BEFORE DELETE ON audit_chain_checks
  FOR EACH ROW EXECUTE FUNCTION audit_chain_checks_immutable();

GRANT SELECT ON audit_chain_checks TO app_rw;
GRANT INSERT ON audit_chain_checks TO app_append;
GRANT SELECT ON audit_chain_checks TO app_verify;

-- The append role must read the chain tip to extend it atomically under RLS.
GRANT SELECT ON domain_event TO app_append;
