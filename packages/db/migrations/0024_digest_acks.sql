-- Increment 1.28: the weekly digest's acknowledgment stamp (docs/01 item 14,
-- docs/03 `digest_acks`).
--
-- The digest itself is computed from rows on every read: seven days of the
-- practice's counts, never a person. What is stored is the owner's
-- acknowledgment of one period: who read it, when, how many chain events
-- the period held, and a hash of the summary they read, so a later reader
-- can tell whether the digest changed after it was acknowledged. One
-- acknowledgment per (tenant, period end); append-only; never deleted.

CREATE TABLE digest_acks (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary_hash text NOT NULL CHECK (length(summary_hash) = 64),
  event_count integer NOT NULL CHECK (event_count >= 0),
  acknowledged_by_id uuid NOT NULL REFERENCES users(id),
  acknowledged_by_name text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT digest_acks_period_order CHECK (period_end >= period_start),
  UNIQUE (tenant_id, period_end)
);

CREATE OR REPLACE FUNCTION digest_acks_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'digest_acks is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER digest_acks_no_update
  BEFORE UPDATE ON digest_acks
  FOR EACH ROW EXECUTE FUNCTION digest_acks_immutable();

CREATE TRIGGER digest_acks_no_delete
  BEFORE DELETE ON digest_acks
  FOR EACH ROW EXECUTE FUNCTION digest_acks_immutable();

ALTER TABLE digest_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_acks FORCE ROW LEVEL SECURITY;

CREATE POLICY digest_acks_isolation ON digest_acks
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON digest_acks TO app_rw;
