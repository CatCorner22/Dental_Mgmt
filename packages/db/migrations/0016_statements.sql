-- Increment 1.10: patient/guarantor statements (generate, preview, freeze).

CREATE TABLE statements (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  account_id uuid NOT NULL REFERENCES guarantor_accounts(id),
  patient_id uuid REFERENCES patients(id),
  as_of date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'held', 'void')),
  patient_due_cents bigint NOT NULL DEFAULT 0,
  insurance_pending_cents bigint NOT NULL DEFAULT 0,
  credit_cents bigint NOT NULL DEFAULT 0,
  hold_reason text,
  snapshot jsonb NOT NULL DEFAULT '{}',
  issued_at timestamptz,
  issued_by_id uuid,
  issued_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT statements_held_requires_reason
    CHECK (status <> 'held' OR (hold_reason IS NOT NULL AND length(btrim(hold_reason)) > 0)),
  CONSTRAINT statements_issued_requires_issuer
    CHECK (
      status <> 'issued'
      OR (issued_at IS NOT NULL AND issued_by_id IS NOT NULL AND issued_by_name IS NOT NULL)
    )
);
CREATE INDEX statements_tenant_account_as_of_idx
  ON statements (tenant_id, account_id, as_of DESC);

CREATE OR REPLACE FUNCTION statements_immutable_when_issued()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'issued' THEN
    RAISE EXCEPTION 'statements row is issued and cannot change';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER statements_no_mutate_after_issue
  BEFORE UPDATE ON statements
  FOR EACH ROW EXECUTE FUNCTION statements_immutable_when_issued();

CREATE TRIGGER statements_no_delete_after_issue
  BEFORE DELETE ON statements
  FOR EACH ROW
  WHEN (OLD.status = 'issued')
  EXECUTE FUNCTION statements_immutable_when_issued();

ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements FORCE ROW LEVEL SECURITY;

CREATE POLICY statements_isolation ON statements
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON statements TO app_rw;
