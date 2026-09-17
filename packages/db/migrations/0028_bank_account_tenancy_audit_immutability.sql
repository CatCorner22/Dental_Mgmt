-- Increment 1.36: four closures the roles-and-RLS layer left open.
--
-- 1. A bank account belongs to one tenant. Rows keyed by (tenant_id,
--    bank_account_id) must name an account of that same tenant, so the pair
--    is a foreign key, not two independent ones.
-- 2. domain_event and phi_access_log are append-only for everyone, the table
--    owner included: a raising BEFORE UPDATE/DELETE trigger, like every other
--    append-only table here (ENABLE ALWAYS so a session's replication role
--    setting cannot switch it off). A superuser can drop any trigger, so it
--    is not refused here: superuser tampering is what the verifier's recorded
--    head and the actor-bearing hash catch, not the database.
-- 3. auth_lookup_recovery_ceremony runs as app_auth_lookup before a tenant is
--    bound; that role reads recovery_ceremonies the way it reads users and
--    sessions (0003), and nothing else.
-- 4. A TOTP code is single-use (RFC 6238 §5.2): the step that last opened a
--    session is kept on the user so an equal or earlier step is refused.

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_step bigint;

ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_tenant_id_key UNIQUE (tenant_id, id);

ALTER TABLE bank_statement_imports
  ADD CONSTRAINT bank_statement_imports_tenant_bank_account_fk
  FOREIGN KEY (tenant_id, bank_account_id) REFERENCES bank_accounts (tenant_id, id);
ALTER TABLE bank_transactions
  ADD CONSTRAINT bank_transactions_tenant_bank_account_fk
  FOREIGN KEY (tenant_id, bank_account_id) REFERENCES bank_accounts (tenant_id, id);
ALTER TABLE reconciliation_runs
  ADD CONSTRAINT reconciliation_runs_tenant_bank_account_fk
  FOREIGN KEY (tenant_id, bank_account_id) REFERENCES bank_accounts (tenant_id, id);
ALTER TABLE deposits
  ADD CONSTRAINT deposits_tenant_bank_account_fk
  FOREIGN KEY (tenant_id, bank_account_id) REFERENCES bank_accounts (tenant_id, id);

CREATE OR REPLACE FUNCTION domain_event_immutable()
RETURNS trigger AS $$
BEGIN
  IF current_setting('is_superuser', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'domain_event is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER domain_event_no_update
  BEFORE UPDATE ON domain_event
  FOR EACH ROW EXECUTE FUNCTION domain_event_immutable();
CREATE TRIGGER domain_event_no_delete
  BEFORE DELETE ON domain_event
  FOR EACH ROW EXECUTE FUNCTION domain_event_immutable();
ALTER TABLE domain_event ENABLE ALWAYS TRIGGER domain_event_no_update;
ALTER TABLE domain_event ENABLE ALWAYS TRIGGER domain_event_no_delete;

CREATE OR REPLACE FUNCTION phi_access_log_immutable()
RETURNS trigger AS $$
BEGIN
  IF current_setting('is_superuser', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'phi_access_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER phi_access_log_no_update
  BEFORE UPDATE ON phi_access_log
  FOR EACH ROW EXECUTE FUNCTION phi_access_log_immutable();
CREATE TRIGGER phi_access_log_no_delete
  BEFORE DELETE ON phi_access_log
  FOR EACH ROW EXECUTE FUNCTION phi_access_log_immutable();
ALTER TABLE phi_access_log ENABLE ALWAYS TRIGGER phi_access_log_no_update;
ALTER TABLE phi_access_log ENABLE ALWAYS TRIGGER phi_access_log_no_delete;

GRANT SELECT ON recovery_ceremonies TO app_auth_lookup;
CREATE POLICY recovery_ceremonies_auth_lookup ON recovery_ceremonies
  FOR SELECT TO app_auth_lookup USING (true);
