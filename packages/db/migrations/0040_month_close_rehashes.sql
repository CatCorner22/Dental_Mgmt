-- Increment 1.56: a month closed under an older package shape can be compared
-- again, without rewriting what the accountant received.
--
-- Increment 1.43 made the package's shape part of its hash and recorded that
-- shape on the close, so the CPA page can tell "the package changed shape" from
-- "a figure moved" rather than reporting the first as the second forever. That
-- was the honest answer, and it has a cost: a month closed under an earlier
-- shape can never again be asked whether a figure moved. Only the entry count
-- and journal total the close froze in their own columns still answer, and they
-- are two figures out of the many the package states. The shape has moved five
-- times since (v1 to v6), so every month closed before the last change is in
-- that position.
--
-- The obvious fix -- recompute the hash and store it on the close -- is wrong,
-- and the close table already says so: `month_closes` refuses every update and
-- every delete. That frozen hash is the record of what the accountant actually
-- received. Overwriting it would assert something false about the past in order
-- to answer a question about the present.
--
-- So a re-hash is an addition, not a rewrite. A baseline says: under this shape,
-- as of this moment, this month hashed to this. The close keeps saying what the
-- accountant received; the baseline gives "has a figure moved since?" something
-- to compare against again, and names the date from which that claim runs.
--
-- One baseline per practice, month and shape, because the baseline is the FIRST
-- reading under that shape. A second would quietly move the line a later
-- comparison is drawn from, and hide any move that happened in between.

CREATE TABLE month_close_rehashes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  /** The shape this baseline was computed under. Never the close's own. */
  package_schema text NOT NULL CHECK (length(btrim(package_schema)) > 0),
  package_hash text NOT NULL CHECK (package_hash ~ '^[0-9a-f]{64}$'),
  /** The two figures the close also froze, recomputed here, so a reader can see them move together. */
  entry_count integer NOT NULL,
  total_cents bigint NOT NULL,
  computed_by_id uuid NOT NULL REFERENCES users(id),
  computed_by_name text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  -- Only a closed month has a baseline: there is nothing to re-hash until a
  -- close froze something to compare against.
  FOREIGN KEY (tenant_id, month) REFERENCES month_closes (tenant_id, month)
);

CREATE UNIQUE INDEX month_close_rehashes_month_schema_uidx
  ON month_close_rehashes (tenant_id, month, package_schema);

CREATE OR REPLACE FUNCTION month_close_rehashes_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'month_close_rehashes is append-only; a baseline is taken once per shape';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER month_close_rehashes_no_update
  BEFORE UPDATE ON month_close_rehashes
  FOR EACH ROW EXECUTE FUNCTION month_close_rehashes_immutable();

CREATE TRIGGER month_close_rehashes_no_delete
  BEFORE DELETE ON month_close_rehashes
  FOR EACH ROW EXECUTE FUNCTION month_close_rehashes_immutable();

-- A baseline under the close's own shape would duplicate the frozen hash and
-- invite a reader to compare the wrong pair. The close is already the baseline
-- for the shape it froze.
CREATE OR REPLACE FUNCTION month_close_rehashes_is_a_later_shape()
RETURNS trigger AS $$
DECLARE frozen text;
BEGIN
  SELECT package_schema INTO frozen FROM month_closes
  WHERE tenant_id = NEW.tenant_id AND month = NEW.month;
  IF frozen = NEW.package_schema THEN
    RAISE EXCEPTION 'month_close_rehashes: % was closed under %, which is already its baseline', NEW.month, frozen;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER month_close_rehashes_is_a_later_shape
  BEFORE INSERT ON month_close_rehashes
  FOR EACH ROW EXECUTE FUNCTION month_close_rehashes_is_a_later_shape();

ALTER TABLE month_close_rehashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE month_close_rehashes FORCE ROW LEVEL SECURITY;

CREATE POLICY month_close_rehashes_isolation ON month_close_rehashes
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON month_close_rehashes TO app_rw;
