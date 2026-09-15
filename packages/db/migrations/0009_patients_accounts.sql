-- Increment 1.1: minimal patient and account headers for the ledger kernel.
-- PHI rows are permitted in Phase 1; synthetic seed data only until pilot BAA.

CREATE TABLE sequences (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  kind text NOT NULL,
  next_val bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, kind)
);

CREATE TABLE patients (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  mrn text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  primary_location_id uuid NOT NULL REFERENCES locations(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid NOT NULL,
  created_by_name text NOT NULL
);
CREATE INDEX patients_tenant_idx ON patients (tenant_id);
CREATE UNIQUE INDEX patients_tenant_mrn_uidx ON patients (tenant_id, mrn);

CREATE TABLE guarantor_accounts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  display_name text NOT NULL,
  statement_hold boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid NOT NULL,
  created_by_name text NOT NULL
);
CREATE INDEX guarantor_accounts_tenant_idx ON guarantor_accounts (tenant_id);

CREATE TABLE account_members (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  account_id uuid NOT NULL REFERENCES guarantor_accounts(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_members_tenant_account_idx ON account_members (tenant_id, account_id);
CREATE UNIQUE INDEX account_members_active_patient_uidx
  ON account_members (tenant_id, patient_id)
  WHERE effective_to IS NULL;

CREATE TABLE carriers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  payer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX carriers_tenant_idx ON carriers (tenant_id);
CREATE UNIQUE INDEX carriers_tenant_name_uidx ON carriers (tenant_id, name);

CREATE TABLE insurance_plans (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  carrier_id uuid NOT NULL REFERENCES carriers(id),
  name text NOT NULL,
  plan_type text NOT NULL DEFAULT 'ppo',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX insurance_plans_tenant_idx ON insurance_plans (tenant_id);

CREATE TABLE patient_coverage (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  plan_id uuid NOT NULL REFERENCES insurance_plans(id),
  rank smallint NOT NULL CHECK (rank IN (1, 2)),
  member_id text,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_coverage_tenant_patient_idx ON patient_coverage (tenant_id, patient_id);
CREATE UNIQUE INDEX patient_coverage_active_rank_uidx
  ON patient_coverage (tenant_id, patient_id, rank)
  WHERE effective_to IS NULL;

-- Stub procedures so charges can carry a structural parent before encounters ship.
CREATE TABLE procedures (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  cdt_code text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX procedures_tenant_patient_idx ON procedures (tenant_id, patient_id);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;

ALTER TABLE sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
ALTER TABLE guarantor_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE account_members FORCE ROW LEVEL SECURITY;
ALTER TABLE carriers FORCE ROW LEVEL SECURITY;
ALTER TABLE insurance_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE patient_coverage FORCE ROW LEVEL SECURITY;
ALTER TABLE procedures FORCE ROW LEVEL SECURITY;

CREATE POLICY sequences_isolation ON sequences
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY patients_isolation ON patients
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY guarantor_accounts_isolation ON guarantor_accounts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY account_members_isolation ON account_members
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY carriers_isolation ON carriers
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY insurance_plans_isolation ON insurance_plans
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY patient_coverage_isolation ON patient_coverage
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY procedures_isolation ON procedures
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON sequences, patients, guarantor_accounts, account_members,
  carriers, insurance_plans, patient_coverage, procedures TO app_rw;
