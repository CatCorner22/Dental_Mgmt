-- Increment 1.47: a control decision may be about a reason code.
--
-- Increment 1.46 let a reason code tighten the dual-release threshold, and
-- recorded on the chain which way each change moved. Loosening one is a
-- control decision rather than a settings change, exactly as switching the
-- after-hours hold off is (Increment 1.31), so the decision register needs to
-- hold a decision whose subject is the reason code itself.
--
-- The subject id is the code, which is the key ledger entries cite and which
-- never changes (Increment 1.45), so a decision keeps pointing at the same
-- reason for as long as the practice holds it.

ALTER TABLE control_decisions DROP CONSTRAINT control_decisions_subject_kind_check;
ALTER TABLE control_decisions ADD CONSTRAINT control_decisions_subject_kind_check
  CHECK (subject_kind IN (
    'sod_finding', 'grant', 'control', 'exception', 'scenario', 'knowledge',
    'detector_finding', 'reason_code'
  ));
