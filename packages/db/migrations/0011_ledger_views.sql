-- Increment 1.1: balance and explanation views over the ledger kernel.

CREATE OR REPLACE VIEW account_balances AS
SELECT
  le.tenant_id,
  le.account_id,
  le.patient_id,
  COALESCE(SUM(CASE WHEN le.gl_bucket = 'patient_ar' THEN le.amount_cents ELSE 0 END), 0)::bigint
    AS patient_ar_net_cents,
  COALESCE(SUM(CASE WHEN le.gl_bucket IN ('ins_ar_primary', 'ins_ar_secondary') THEN le.amount_cents ELSE 0 END), 0)::bigint
    AS insurance_pending_cents,
  COALESCE(SUM(CASE WHEN le.gl_bucket = 'unapplied_credit' THEN le.amount_cents ELSE 0 END), 0)::bigint
    AS unapplied_credit_cents,
  COALESCE(SUM(CASE WHEN le.gl_bucket = 'undeposited_funds' THEN le.amount_cents ELSE 0 END), 0)::bigint
    AS undeposited_funds_cents
FROM ledger_entries le
GROUP BY le.tenant_id, le.account_id, le.patient_id;

CREATE OR REPLACE VIEW ledger_explanations AS
SELECT
  le.tenant_id,
  le.id AS entry_id,
  le.patient_id,
  le.account_id,
  le.kind,
  le.amount_cents,
  le.effective_date,
  le.posted_at,
  le.gl_bucket,
  le.reason_code,
  rc.label AS reason_label,
  le.created_by_name AS poster_name,
  le.procedure_id,
  le.memo
FROM ledger_entries le
LEFT JOIN reason_codes rc
  ON rc.tenant_id = le.tenant_id AND rc.code = le.reason_code;

GRANT SELECT ON account_balances, ledger_explanations TO app_rw;
