-- Increment 1.5: bank statement import + reconciliation stub (parse, stage, variance queue).

CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  location_id uuid REFERENCES locations(id),
  display_name text NOT NULL,
  institution_name text,
  account_number_last4 text,
  currency text NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_accounts_tenant_idx ON bank_accounts (tenant_id);

CREATE TABLE bank_statement_imports (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  format text NOT NULL DEFAULT 'csv'
    CHECK (format IN ('csv')),
  file_name text,
  file_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'validated'
    CHECK (status IN ('validated', 'failed', 'applied')),
  row_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  period_start date,
  period_end date,
  summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid NOT NULL,
  created_by_name text NOT NULL,
  completed_at timestamptz
);
CREATE INDEX bank_statement_imports_tenant_created_idx
  ON bank_statement_imports (tenant_id, created_at DESC);

CREATE TABLE bank_transactions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  import_id uuid REFERENCES bank_statement_imports(id),
  posted_date date NOT NULL,
  description text NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  external_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bank_account_id, external_key)
);
CREATE INDEX bank_transactions_tenant_account_date_idx
  ON bank_transactions (tenant_id, bank_account_id, posted_date DESC);
CREATE INDEX bank_transactions_import_idx ON bank_transactions (import_id);

CREATE TABLE reconciliation_runs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  import_id uuid REFERENCES bank_statement_imports(id),
  source text NOT NULL DEFAULT 'statement_import'
    CHECK (source IN ('statement_import', 'aggregator_feed')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'matched', 'variance', 'cleared')),
  bank_net_cents bigint NOT NULL DEFAULT 0,
  matched_cents bigint NOT NULL DEFAULT 0,
  variance_cents bigint NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid NOT NULL,
  created_by_name text NOT NULL,
  cleared_at timestamptz,
  cleared_by_id uuid,
  cleared_by_name text
);
CREATE INDEX reconciliation_runs_tenant_created_idx
  ON reconciliation_runs (tenant_id, created_at DESC);

CREATE TABLE reconciliation_variances (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  run_id uuid NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  bank_transaction_id uuid REFERENCES bank_transactions(id),
  kind text NOT NULL
    CHECK (kind IN ('unmatched_bank', 'unmatched_ledger', 'amount_mismatch', 'matched_deposit')),
  amount_cents bigint NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'matched', 'cleared', 'waived')),
  match_ref jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reconciliation_variances_run_idx ON reconciliation_variances (run_id);

CREATE OR REPLACE FUNCTION bank_transactions_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bank_transactions is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_transactions_no_update
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION bank_transactions_immutable();

CREATE TRIGGER bank_transactions_no_delete
  BEFORE DELETE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION bank_transactions_immutable();

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_variances ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_imports FORCE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_variances FORCE ROW LEVEL SECURITY;

CREATE POLICY bank_accounts_isolation ON bank_accounts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY bank_statement_imports_isolation ON bank_statement_imports
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY bank_transactions_isolation ON bank_transactions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY reconciliation_runs_isolation ON reconciliation_runs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY reconciliation_variances_isolation ON reconciliation_variances
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON bank_accounts, bank_statement_imports, reconciliation_runs, reconciliation_variances TO app_rw;
GRANT SELECT, INSERT ON bank_transactions TO app_rw;
