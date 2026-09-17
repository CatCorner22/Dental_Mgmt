-- Increment 1.27: a decision can be retired.
--
-- The register is append-only, so "this decision no longer stands" is itself
-- a row: kind 'retire', superseding the decision it ends, with a note and no
-- review date. The engine treats a retired subject as undecided again: no
-- licence, no coverage, back to "No decision yet". Nothing auto-renews.

ALTER TABLE control_decisions DROP CONSTRAINT control_decisions_kind_check;
ALTER TABLE control_decisions ADD CONSTRAINT control_decisions_kind_check
  CHECK (kind IN ('remediate', 'compensate', 'accept_residual', 'monitor', 'insure', 'retire'));
