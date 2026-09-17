-- Increment 1.26: a control decision may govern a detector finding.
--
-- The decision register (0013) names what a decision can be about. A
-- detector's control_findings row (0019) joins that list: the subject id is
-- the finding id. The detectors still own the row's open/closed status; the
-- decision records what the owner made of it, dated and attributed, and its
-- review date is watched by the decision_unreviewed detector like any other.

ALTER TABLE control_decisions DROP CONSTRAINT control_decisions_subject_kind_check;
ALTER TABLE control_decisions ADD CONSTRAINT control_decisions_subject_kind_check
  CHECK (subject_kind IN ('sod_finding', 'grant', 'control', 'exception', 'scenario', 'knowledge', 'detector_finding'));
