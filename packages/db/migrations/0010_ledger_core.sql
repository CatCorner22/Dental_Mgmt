-- Increment 1.1: append-only ledger kernel with DB-enforced invariants.

CREATE TABLE reason_codes (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('adjustment', 'write_off', 'refund', 'reversal', 'transfer', 'variance')),
  label text NOT NULL,
  requires_approval_over_cents bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, code)
);
CREATE INDEX reason_codes_tenant_kind_idx ON reason_codes (tenant_id, kind);

CREATE TABLE ledger_entries (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  account_id uuid NOT NULL REFERENCES guarantor_accounts(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  kind text NOT NULL CHECK (kind IN (
    'charge', 'patient_payment', 'insurance_payment', 'adjustment', 'write_off',
    'refund', 'transfer_out', 'transfer_in', 'reversal'
  )),
  gl_bucket text NOT NULL CHECK (gl_bucket IN (
    'patient_ar', 'ins_ar_primary', 'ins_ar_secondary', 'unapplied_credit', 'undeposited_funds'
  )),
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  reason_code text,
  effective_date date NOT NULL,
  posted_at timestamptz NOT NULL,
  created_by_id uuid NOT NULL,
  created_by_name text NOT NULL,
  encounter_id uuid,
  procedure_id uuid REFERENCES procedures(id),
  claim_id uuid,
  coverage_id uuid REFERENCES patient_coverage(id),
  reverses_entry_id uuid REFERENCES ledger_entries(id),
  approval_request_id uuid,
  tender text CHECK (tender IS NULL OR tender IN ('cash', 'check', 'card', 'ach', 'eft')),
  memo text,
  idempotency_key text NOT NULL,
  insurance_expected_cents bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_entries_reason_fk
    FOREIGN KEY (tenant_id, reason_code) REFERENCES reason_codes (tenant_id, code),
  CONSTRAINT ledger_entries_charge_requires_procedure
    CHECK (kind <> 'charge' OR procedure_id IS NOT NULL),
  CONSTRAINT ledger_entries_reason_required
    CHECK (kind NOT IN ('adjustment', 'write_off', 'refund', 'reversal', 'transfer_out', 'transfer_in')
      OR reason_code IS NOT NULL),
  CONSTRAINT ledger_entries_reversal_requires_target
    CHECK (kind <> 'reversal' OR reverses_entry_id IS NOT NULL)
);
CREATE INDEX ledger_entries_tenant_account_idx ON ledger_entries (tenant_id, account_id, posted_at);
CREATE INDEX ledger_entries_tenant_patient_idx ON ledger_entries (tenant_id, patient_id, effective_date);
CREATE UNIQUE INDEX ledger_entries_tenant_idempotency_uidx
  ON ledger_entries (tenant_id, idempotency_key);

CREATE TABLE payment_allocations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  payment_entry_id uuid NOT NULL REFERENCES ledger_entries(id),
  charge_entry_id uuid NOT NULL REFERENCES ledger_entries(id),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_allocations_payment_idx ON payment_allocations (payment_entry_id);
CREATE INDEX payment_allocations_charge_idx ON payment_allocations (charge_entry_id);

CREATE TABLE estimates (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  procedure_id uuid REFERENCES procedures(id),
  insurance_est_cents bigint NOT NULL DEFAULT 0,
  writeoff_est_cents bigint NOT NULL DEFAULT 0,
  patient_est_cents bigint NOT NULL DEFAULT 0,
  as_of date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX estimates_tenant_patient_idx ON estimates (tenant_id, patient_id, as_of);

CREATE OR REPLACE FUNCTION ledger_entries_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_no_update
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

CREATE TRIGGER ledger_entries_no_delete
  BEFORE DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

CREATE OR REPLACE FUNCTION payment_allocations_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'payment_allocations is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_allocations_no_update
  BEFORE UPDATE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION payment_allocations_immutable();

CREATE TRIGGER payment_allocations_no_delete
  BEFORE DELETE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION payment_allocations_immutable();

CREATE OR REPLACE FUNCTION ledger_reversal_must_mirror()
RETURNS trigger AS $$
DECLARE
  orig ledger_entries%ROWTYPE;
  reversed boolean;
BEGIN
  IF NEW.kind <> 'reversal' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO orig FROM ledger_entries WHERE id = NEW.reverses_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reversal_target_missing';
  END IF;
  IF orig.tenant_id <> NEW.tenant_id OR orig.patient_id <> NEW.patient_id THEN
    RAISE EXCEPTION 'reversal_scope_mismatch';
  END IF;
  IF NEW.amount_cents <> -orig.amount_cents THEN
    RAISE EXCEPTION 'reversal_amount_mismatch';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM ledger_entries r
    WHERE r.kind = 'reversal' AND r.reverses_entry_id = NEW.reverses_entry_id AND r.id <> NEW.id
  ) INTO reversed;
  IF reversed THEN
    RAISE EXCEPTION 'already_reversed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_reversal_mirror
  BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_reversal_must_mirror();

CREATE OR REPLACE FUNCTION payment_allocations_within_bounds()
RETURNS trigger AS $$
DECLARE
  pay_amount bigint;
  charge_amount bigint;
  pay_total bigint;
  charge_total bigint;
BEGIN
  SELECT amount_cents INTO pay_amount FROM ledger_entries WHERE id = NEW.payment_entry_id;
  SELECT amount_cents INTO charge_amount FROM ledger_entries WHERE id = NEW.charge_entry_id;

  IF pay_amount IS NULL OR charge_amount IS NULL THEN
    RAISE EXCEPTION 'allocation_unknown_entry';
  END IF;
  IF pay_amount >= 0 OR charge_amount <= 0 THEN
    RAISE EXCEPTION 'allocation_wrong_entry_kind';
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0) INTO pay_total
    FROM payment_allocations WHERE payment_entry_id = NEW.payment_entry_id;
  SELECT COALESCE(SUM(amount_cents), 0) INTO charge_total
    FROM payment_allocations WHERE charge_entry_id = NEW.charge_entry_id;

  IF pay_total + NEW.amount_cents > -pay_amount THEN
    RAISE EXCEPTION 'allocation_exceeds_payment';
  END IF;
  IF charge_total + NEW.amount_cents > charge_amount THEN
    RAISE EXCEPTION 'allocation_exceeds_charge';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_allocations_bounds
  BEFORE INSERT ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION payment_allocations_within_bounds();

ALTER TABLE reason_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

ALTER TABLE reason_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations FORCE ROW LEVEL SECURITY;
ALTER TABLE estimates FORCE ROW LEVEL SECURITY;

CREATE POLICY reason_codes_isolation ON reason_codes
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY ledger_entries_isolation ON ledger_entries
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY payment_allocations_isolation ON payment_allocations
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY estimates_isolation ON estimates
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON reason_codes TO app_rw;
GRANT SELECT, INSERT ON ledger_entries, payment_allocations TO app_rw;
GRANT SELECT, INSERT, UPDATE ON estimates TO app_rw;
GRANT INSERT ON ledger_entries, payment_allocations TO app_append;
-- Triggers read payment/charge rows while enforcing bounds and reversal mirrors.
GRANT SELECT ON ledger_entries, payment_allocations TO app_append;
