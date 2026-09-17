-- Increment 1.37: the reversal-and-repost correction pair (docs/13 item 22,
-- "unless it is a reversal-and-repost pair with reason 'prior_period'", and
-- feature 20, "the service writes a reversal entry ... and a repost entry ...
-- both carrying corrects_entry_id = the original and the same required reason
-- code, in one transaction; there is no 'correction' kind").
--
-- Increment 1.36 admitted any row into a closed month on the reason code
-- alone. A reason code is a label; the pair is the arithmetic. This migration
-- makes the pair the only way in: a row effective-dated into a closed month
-- now needs reason 'prior_period' AND a corrects_entry_id, the reversal must
-- mirror the entry it reverses, an entry is reversed once, and a repost is
-- admitted only behind a reversal correcting the same entry.

ALTER TABLE ledger_entries ADD COLUMN corrects_entry_id uuid REFERENCES ledger_entries(id);

CREATE INDEX ledger_entries_tenant_corrects_idx
  ON ledger_entries (tenant_id, corrects_entry_id)
  WHERE corrects_entry_id IS NOT NULL;

-- A reversal that corrects an entry reverses that same entry. The other half
-- of the rule — a repost carries corrects_entry_id only behind its reversal —
-- needs a lookup, so it lives in the trigger below rather than in a CHECK.
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_reversal_corrects_its_original
  CHECK (
    corrects_entry_id IS NULL
    OR kind <> 'reversal'
    OR reverses_entry_id = corrects_entry_id
  );

CREATE OR REPLACE FUNCTION ledger_entries_correction_pair()
RETURNS trigger AS $$
DECLARE
  original ledger_entries%ROWTYPE;
  reversal_count integer;
BEGIN
  IF NEW.kind = 'reversal' AND NEW.reverses_entry_id IS NOT NULL THEN
    SELECT * INTO original
    FROM ledger_entries
    WHERE id = NEW.reverses_entry_id AND tenant_id = NEW.tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'reversal_original_missing: no entry % in this practice to reverse', NEW.reverses_entry_id;
    END IF;

    IF original.kind = 'reversal' THEN
      RAISE EXCEPTION
        'reversal_of_reversal: entry % is itself a reversal; correct the entry it reverses instead', original.id;
    END IF;

    SELECT count(*) INTO reversal_count
    FROM ledger_entries
    WHERE tenant_id = NEW.tenant_id AND kind = 'reversal' AND reverses_entry_id = NEW.reverses_entry_id;

    IF reversal_count > 0 THEN
      RAISE EXCEPTION
        'already_reversed: entry % is already reversed; correct the repost instead', original.id;
    END IF;

    IF NEW.amount_cents <> -original.amount_cents THEN
      RAISE EXCEPTION
        'reversal_not_mirrored: a reversal of % must be %, not %',
        original.id, -original.amount_cents, NEW.amount_cents;
    END IF;

    RETURN NEW;
  END IF;

  -- A repost: any non-reversal row naming the entry it corrects. It is admitted
  -- only behind the reversal that cleared that entry, in the same practice, and
  -- it carries that reversal's reason code. Written in one transaction with it.
  IF NEW.corrects_entry_id IS NOT NULL THEN
    SELECT count(*) INTO reversal_count
    FROM ledger_entries
    WHERE tenant_id = NEW.tenant_id
      AND kind = 'reversal'
      AND corrects_entry_id = NEW.corrects_entry_id;

    IF reversal_count = 0 THEN
      RAISE EXCEPTION
        'repost_without_reversal: a repost of % posts only behind the reversal that clears it', NEW.corrects_entry_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_correction_pair
  BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_correction_pair();

-- The closed-month refusal tightens: the reason code names the intent, the
-- corrects_entry_id proves the arithmetic. A bare adjustment labelled
-- 'prior_period' no longer reaches a month the accountant has taken.
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

  IF NEW.reason_code IS DISTINCT FROM 'prior_period' OR NEW.corrects_entry_id IS NULL THEN
    RAISE EXCEPTION
      'month_closed: % effective % falls in %, closed to the accountant; correct the entry it replaces, which posts today as a reversal-and-repost pair with reason prior_period',
      NEW.kind, NEW.effective_date, closed_month;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
