-- Increment 1.40: the late posting into a sealed day.
--
-- A day close is the practice's own statement of what that day took in: the
-- deposit batch, the day-sheet total, the variance between them, counted twice
-- and frozen. Until now a ledger row effective-dated into a day already frozen
-- landed silently. The sealed figures never moved, so the day's statement and
-- the day's ledger drifted apart with nothing recording that they had.
--
-- That gap is the shape of a skim: seal the day at the figure the owner
-- expects, post the rest of it afterward. So the database stamps every row it
-- admits against a frozen day with the day it landed behind. The stamp is the
-- database's own observation, not the writer's claim — the trigger overwrites
-- whatever the caller passed, and ledger_entries carries no UPDATE grant, so
-- no later hand can move it.
--
-- The row is admitted, not refused. A payment that arrived arrived, and the
-- front desk must be able to record it; the month close (migration 0029) is
-- where the refusal belongs, because a month is what the practice hands its
-- accountant. A day is the practice's own, and the honest treatment of a late
-- posting into one is to admit it, name it, and count it.

ALTER TABLE ledger_entries ADD COLUMN posted_after_close boolean NOT NULL DEFAULT false;
ALTER TABLE ledger_entries ADD COLUMN closed_day_id uuid REFERENCES day_closes(id);

-- The flag and the day are one fact stated twice; neither stands without the
-- other. The flag reads in a WHERE clause, the id names which day it was.
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_late_names_its_day
  CHECK (posted_after_close = (closed_day_id IS NOT NULL));

CREATE INDEX ledger_entries_closed_day_idx
  ON ledger_entries (tenant_id, closed_day_id)
  WHERE closed_day_id IS NOT NULL;

CREATE OR REPLACE FUNCTION ledger_entries_stamp_late_posting()
RETURNS trigger AS $$
DECLARE
  frozen_day uuid;
BEGIN
  -- The day this row belongs to, for this location, if the practice has sealed
  -- it. day_closes holds at most one row per (tenant, location, business date).
  SELECT id INTO frozen_day
  FROM day_closes
  WHERE tenant_id = NEW.tenant_id
    AND location_id = NEW.location_id
    AND business_date = NEW.effective_date
    AND status = 'frozen';

  NEW.closed_day_id := frozen_day;
  NEW.posted_after_close := frozen_day IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fires after the correction, month-close, and approval triggers, which gate.
-- This one only records: a row that reaches it is a row the practice admitted.
CREATE TRIGGER ledger_entries_stamp_late_posting
  BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_stamp_late_posting();

-- The posting path runs as app_append, and the trigger reads day_closes on
-- every insert, exactly as migration 0026 needed locations and 0029 needed
-- month_closes. Read-only: app_append seals no day.
GRANT SELECT ON day_closes TO app_append;
