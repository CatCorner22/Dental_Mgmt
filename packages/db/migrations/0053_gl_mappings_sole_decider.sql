-- Increment 1.75: the practice that has only one person who may decide.
--
-- Migration 0028 wrote maker-checker into the table itself: a mapping's
-- decider is never its proposer, checked by the database so no code path can
-- bypass it. That is the right default, and it deadlocks a practice that has
-- one administrator — which this product gives a practice no way to change,
-- since no route writes `users.role` and the only user this product inserts is
-- hard-coded `readonly`. Such a practice proposes a mapping nobody may decide,
-- leaves every journal line unmapped, and closes no month, ever.
--
-- The CHECK cannot express the way out, because the way out is a fact in
-- another table: the practice has recorded, in the append-only decision
-- register, that it accepts the residual risk of deciding alone. So the
-- constraint becomes a trigger that can read that register.
--
-- What does NOT change: a decider who is not the proposer is admitted exactly
-- as before, and a self-decision with no live decision behind it is refused
-- exactly as before, with a message naming the register rather than a person
-- the practice may not have. The guarantee moves from "never" to "never
-- without a recorded, reviewable decision" — and it stays the database's.

ALTER TABLE gl_mappings DROP CONSTRAINT gl_mappings_maker_ne_checker;

/**
 * Whether this practice has recorded that one administrator decides alone.
 *
 * "Live" is derived, never stored: the newest decision on this subject wins,
 * and it licenses only while its kind still says the practice chose to work
 * this way. A `retire` row — which `control_decisions` has carried since
 * migration 0023, and which reads as "undecided again" — therefore tightens
 * the control back with no column anywhere to correct. This is the same
 * newest-row-wins reading `seat_invitations` took in migration 0052, and the
 * same reason: a flag would be a second answer that could contradict the rows
 * underneath it.
 *
 * An overdue review does not revoke the licence here, deliberately. The
 * service and the screens report it as overdue (Increment 1.31's reading of a
 * control standing down), and a licence that expired inside a transaction
 * would refuse a practice mid-month with no warning and no act available.
 */
CREATE OR REPLACE FUNCTION gl_mappings_sole_decider_licensed(practice uuid)
RETURNS boolean AS $$
  SELECT COALESCE(
    (
      SELECT d.kind IN ('accept_residual', 'compensate')
      FROM control_decisions d
      WHERE d.tenant_id = practice
        AND d.subject_kind = 'control'
        AND d.subject_id = 'gl_mapping_maker_checker'
      ORDER BY d.decided_at DESC, d.id DESC
      LIMIT 1
    ),
    false
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION gl_mappings_maker_checker()
RETURNS trigger AS $$
BEGIN
  IF NEW.decided_by_id IS NULL OR NEW.decided_by_id <> NEW.proposed_by_id THEN
    RETURN NEW;
  END IF;
  IF gl_mappings_sole_decider_licensed(NEW.tenant_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION
    'gl_mappings_maker_ne_checker: % proposed this mapping, and this practice has recorded no decision that one administrator may decide alone',
    NEW.proposed_by_id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gl_mappings_maker_checker_ins
  BEFORE INSERT ON gl_mappings
  FOR EACH ROW EXECUTE FUNCTION gl_mappings_maker_checker();
CREATE TRIGGER gl_mappings_maker_checker_upd
  BEFORE UPDATE ON gl_mappings
  FOR EACH ROW EXECUTE FUNCTION gl_mappings_maker_checker();
