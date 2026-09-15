-- Increment 1.2: control policies and approval requests for dual-release inbox.

CREATE TABLE control_policies (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  version integer NOT NULL,
  rulebook_version text NOT NULL,
  policy jsonb NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid NOT NULL,
  created_by_name text NOT NULL,
  UNIQUE (tenant_id, version)
);
CREATE INDEX control_policies_tenant_effective_idx
  ON control_policies (tenant_id, effective_from DESC);

CREATE TABLE approval_requests (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'expired', 'cancelled')),
  channel text NOT NULL,
  amount_cents bigint NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  subject_kind text NOT NULL DEFAULT 'ledger_post',
  subject_id uuid,
  held_payload jsonb NOT NULL,
  evaluation jsonb NOT NULL,
  eligible_second_roles text[] NOT NULL DEFAULT '{}',
  requester_id uuid NOT NULL,
  requester_name text NOT NULL,
  second_approver_id uuid,
  second_approver_name text,
  decision_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  resulting_entry_id uuid REFERENCES ledger_entries(id),
  CONSTRAINT approval_requester_ne_second
    CHECK (second_approver_id IS NULL OR requester_id <> second_approver_id),
  CONSTRAINT approval_decline_requires_reason
    CHECK (status <> 'declined' OR decision_reason IS NOT NULL)
);
CREATE INDEX approval_requests_tenant_status_idx
  ON approval_requests (tenant_id, status, requested_at DESC);

CREATE TABLE approvals_log (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  request_id uuid NOT NULL REFERENCES approval_requests(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'declined', 'cancelled')),
  actor_id uuid NOT NULL,
  actor_name text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approvals_log_request_idx ON approvals_log (request_id);

ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_approval_fk
  FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id);

CREATE OR REPLACE FUNCTION control_policies_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'control_policies is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER control_policies_no_update
  BEFORE UPDATE ON control_policies
  FOR EACH ROW EXECUTE FUNCTION control_policies_immutable();

CREATE TRIGGER control_policies_no_delete
  BEFORE DELETE ON control_policies
  FOR EACH ROW EXECUTE FUNCTION control_policies_immutable();

CREATE OR REPLACE FUNCTION approvals_log_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'approvals_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approvals_log_no_update
  BEFORE UPDATE ON approvals_log
  FOR EACH ROW EXECUTE FUNCTION approvals_log_immutable();

CREATE TRIGGER approvals_log_no_delete
  BEFORE DELETE ON approvals_log
  FOR EACH ROW EXECUTE FUNCTION approvals_log_immutable();

ALTER TABLE control_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE control_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE approval_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE approvals_log FORCE ROW LEVEL SECURITY;

CREATE POLICY control_policies_isolation ON control_policies
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY approval_requests_isolation ON approval_requests
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY approvals_log_isolation ON approvals_log
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON control_policies TO app_rw;
GRANT SELECT, INSERT, UPDATE ON approval_requests TO app_rw;
GRANT SELECT, INSERT ON approvals_log TO app_rw;
