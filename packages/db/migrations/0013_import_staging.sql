-- Increment 1.3: Curve Hero report-import staging (parse + validate stub; no ledger apply).

CREATE TABLE import_runs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  source_system text NOT NULL DEFAULT 'curve_hero'
    CHECK (source_system IN ('curve_hero')),
  report_kind text NOT NULL
    CHECK (report_kind IN (
      'day_sheet',
      'ar_aging',
      'deposit_slip',
      'patient_header',
      'coverage_header'
    )),
  location_id uuid REFERENCES locations(id),
  business_date date,
  file_name text,
  file_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'validated', 'failed', 'applied', 'superseded')),
  row_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid NOT NULL,
  created_by_name text NOT NULL,
  completed_at timestamptz
);
CREATE INDEX import_runs_tenant_created_idx
  ON import_runs (tenant_id, created_at DESC);
CREATE INDEX import_runs_tenant_kind_date_idx
  ON import_runs (tenant_id, report_kind, business_date DESC);

CREATE TABLE import_staged_rows (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  run_id uuid NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  source_key text,
  row_sha256 text NOT NULL,
  payload jsonb NOT NULL,
  validation_errors text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, row_number)
);
CREATE INDEX import_staged_rows_run_idx ON import_staged_rows (run_id);

ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_staged_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE import_staged_rows FORCE ROW LEVEL SECURITY;

CREATE POLICY import_runs_isolation ON import_runs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY import_staged_rows_isolation ON import_staged_rows
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON import_runs, import_staged_rows TO app_rw;
