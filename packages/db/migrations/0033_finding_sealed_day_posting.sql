-- Increment 1.42: the sealed-day posting detector writes control_findings.
--
-- posting_into_sealed_day: a first posting the database stamped against a day
-- the practice had already frozen (migration 0032). Halves of a correction are
-- left out by the detector rather than by this constraint: a correction names
-- the entry it replaces and carries its own reason, so it announces itself,
-- while a first posting into a sealed day announces nothing.
--
-- The subject is the ledger entry, which the constraint already admits, so
-- only the kind list widens.

ALTER TABLE control_findings DROP CONSTRAINT control_findings_kind_check;
ALTER TABLE control_findings ADD CONSTRAINT control_findings_kind_check
  CHECK (kind IN (
    'unmatched_bank_line_48h', 'degraded_owner_clearance', 'decision_unreviewed',
    'release_without_approval', 'backdated_posting', 'duplicate_patient_payment',
    'deposit_not_banked', 'sole_holder_critical_duty', 'posting_into_sealed_day'
  ));
