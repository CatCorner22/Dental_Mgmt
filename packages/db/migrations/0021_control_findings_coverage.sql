-- Increment 1.25: two coverage detectors write control_findings.
--
-- deposit_not_banked: a deposit the practice prepared that no imported bank
-- credit has matched after the banking lag (docs/05 "deposit-batch vs bank
-- gaps"). sole_holder_critical_duty: a high-weight duty held live by exactly
-- one active person (docs/05 "sole ownership of a critical process"). The
-- subjects are the deposit and the entitlement id.

ALTER TABLE control_findings DROP CONSTRAINT control_findings_kind_check;
ALTER TABLE control_findings ADD CONSTRAINT control_findings_kind_check
  CHECK (kind IN (
    'unmatched_bank_line_48h', 'degraded_owner_clearance', 'decision_unreviewed',
    'release_without_approval', 'backdated_posting', 'duplicate_patient_payment',
    'deposit_not_banked', 'sole_holder_critical_duty'
  ));

ALTER TABLE control_findings DROP CONSTRAINT control_findings_subject_kind_check;
ALTER TABLE control_findings ADD CONSTRAINT control_findings_subject_kind_check
  CHECK (subject_kind IN ('bank_transaction', 'reconciliation_run', 'control_decision', 'ledger_entry', 'deposit', 'entitlement'));
