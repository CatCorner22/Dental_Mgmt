-- Increment 1.24: ledger detectors write control_findings too.
--
-- Three more finding kinds, all on ledger rows: a guarded-channel entry
-- above the active threshold that cites neither an approved request nor a
-- policy exception (the database trigger should make this impossible, so
-- it is a chain-integrity alarm); a reversal, adjustment, or write-off
-- posted long after its effective date; two patient payments on one
-- account with the same amount and effective date, neither reversed.
-- The subject of each is the ledger entry.

ALTER TABLE control_findings DROP CONSTRAINT control_findings_kind_check;
ALTER TABLE control_findings ADD CONSTRAINT control_findings_kind_check
  CHECK (kind IN (
    'unmatched_bank_line_48h', 'degraded_owner_clearance', 'decision_unreviewed',
    'release_without_approval', 'backdated_posting', 'duplicate_patient_payment'
  ));

ALTER TABLE control_findings DROP CONSTRAINT control_findings_subject_kind_check;
ALTER TABLE control_findings ADD CONSTRAINT control_findings_subject_kind_check
  CHECK (subject_kind IN ('bank_transaction', 'reconciliation_run', 'control_decision', 'ledger_entry'));
