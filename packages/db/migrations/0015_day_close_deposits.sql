-- Increment 1.6: location-scoped deposits and atomic day close freeze.

CREATE TABLE deposits (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  business_date date NOT NULL,
  method text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  reference text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'batched', 'closed')),
  import_staged_row_id uuid REFERENCES import_staged_rows(id),
  day_close_id uuid,
  prepared_by_id uuid NOT NULL,
  prepared_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, import_staged_row_id)
);

CREATE TABLE day_closes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  business_date date NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'frozen')),
  deposit_total_cents bigint NOT NULL DEFAULT 0,
  day_sheet_total_cents bigint NOT NULL DEFAULT 0,
  variance_cents bigint NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}',
  frozen_at timestamptz,
  frozen_by_id uuid,
  frozen_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, location_id, business_date)
);
CREATE INDEX deposits_tenant_location_date_idx
  ON deposits (tenant_id, location_id, business_date DESC);
CREATE INDEX day_closes_tenant_location_date_idx
  ON day_closes (tenant_id, location_id, business_date DESC);

ALTER TABLE deposits
  ADD CONSTRAINT deposits_day_close_fk
  FOREIGN KEY (day_close_id) REFERENCES day_closes(id);

CREATE OR REPLACE FUNCTION day_closes_immutable_when_frozen()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'frozen' THEN
    RAISE EXCEPTION 'day_closes row is frozen and cannot change';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER day_closes_no_mutate_after_freeze
  BEFORE UPDATE ON day_closes
  FOR EACH ROW EXECUTE FUNCTION day_closes_immutable_when_frozen();

CREATE TRIGGER day_closes_no_delete_after_freeze
  BEFORE DELETE ON day_closes
  FOR EACH ROW
  WHEN (OLD.status = 'frozen')
  EXECUTE FUNCTION day_closes_immutable_when_frozen();

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits FORCE ROW LEVEL SECURITY;
ALTER TABLE day_closes FORCE ROW LEVEL SECURITY;

CREATE POLICY deposits_isolation ON deposits
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY day_closes_isolation ON day_closes
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON deposits, day_closes TO app_rw;
