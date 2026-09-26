-- Increment 1.36: the month close and the prior-period refusal (docs/13 item 22:
-- "Any entry effective-dated into a closed month is refused unless it is a
-- reversal-and-repost pair with reason 'prior_period' ... posts today, and
-- fires the retroactive hard event").
--
-- Closing a month freezes what the practice told its accountant: the period,
-- the package hash at the moment of closing, the journal's entry count and
-- total, and who closed it. One close per month; append-only; a month is
-- never re-opened, because re-opening would make the frozen hash a lie.
-- A later correction posts today with reason 'prior_period', which the
-- retroactive-entry hard event already surfaces to the owner.

CREATE TABLE month_closes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  period_start date NOT NULL,
  period_end date NOT NULL,
  package_hash text NOT NULL CHECK (length(package_hash) = 64),
  entry_count integer NOT NULL CHECK (entry_count >= 0),
  total_cents bigint NOT NULL,
  closed_by_id uuid NOT NULL REFERENCES users(id),
  closed_by_name text NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT month_closes_period_order CHECK (period_end >= period_start),
  UNIQUE (tenant_id, month)
);

CREATE OR REPLACE FUNCTION month_closes_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'month_closes is append-only; a closed month is never re-opened';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER month_closes_no_update
  BEFORE UPDATE ON month_closes
  FOR EACH ROW EXECUTE FUNCTION month_closes_immutable();

CREATE TRIGGER month_closes_no_delete
  BEFORE DELETE ON month_closes
  FOR EACH ROW EXECUTE FUNCTION month_closes_immutable();

ALTER TABLE month_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE month_closes FORCE ROW LEVEL SECURITY;

CREATE POLICY month_closes_isolation ON month_closes
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON month_closes TO app_rw;
-- The posting path runs as app_append and must read the closes to refuse a
-- back-dated entry, exactly as it reads locations for the after-hours hold.
GRANT SELECT ON month_closes TO app_append;

-- The refusal: an entry effective-dated into a closed month is refused unless
-- it carries reason 'prior_period', the reason code the correction pair uses.
-- The retroactive-entry hard event still fires on it, because it posts today
-- against an old effective date; that alarm is the point, not a side effect.
CREATE OR REPLACE FUNCTION ledger_entries_month_not_closed()
RETURNS trigger AS $$
DECLARE
  closed_month text;
BEGIN
  SELECT month INTO closed_month
  FROM month_closes
  WHERE tenant_id = NEW.tenant_id
    AND NEW.effective_date BETWEEN period_start AND period_end
  LIMIT 1;

  IF closed_month IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.reason_code IS DISTINCT FROM 'prior_period' THEN
    RAISE EXCEPTION
      'month_closed: % effective % falls in %, closed to the accountant; post it today with reason prior_period instead',
      NEW.kind, NEW.effective_date, closed_month;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_month_not_closed
  BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_month_not_closed();
