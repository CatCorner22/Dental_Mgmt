-- Increment 1.51: the accountant attests the channels the product cannot
-- enforce (docs/13 item 22's Attest tab).
--
-- Two of the six dual-release channels are `external` in this build: the
-- product holds no vendor payments and no payroll file, so it can evaluate
-- nothing about them. docs/05 forbids showing such a channel as enforced,
-- and the coverage table has said "attested, never enforced" since Increment
-- 1.12 — with nothing behind the word. This is what stands behind it: a dated
-- assertion, by a named person, that someone reviewed that channel's month.
--
-- One row per practice, month and channel. It is append-only and never
-- superseded: an attestation is an assertion made on a date by a person who
-- was willing to make it, and a later opinion is a later month's row, not an
-- edit of this one. That is the same treatment the chain gives every other
-- assertion this product records.
--
-- `attested_seat` says whether the outside accountant or the practice itself
-- reviewed the channel, because an attestation the practice makes about its
-- own external channel is worth less than one an independent reader makes,
-- and a reader of the coverage table is entitled to tell them apart.

CREATE TABLE channel_attestations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  channel text NOT NULL CHECK (length(btrim(channel)) > 0),
  /** What was reviewed and against what; at least ten characters. */
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  attested_seat text NOT NULL CHECK (attested_seat IN ('accountant', 'practice')),
  attested_by_id uuid NOT NULL REFERENCES users(id),
  attested_by_name text NOT NULL,
  attested_at timestamptz NOT NULL DEFAULT now()
);

-- Named rather than left to a table-level UNIQUE, so the constraint the schema
-- declares and the one the database holds carry the same name; the prefix
-- serves the per-month read as well.
CREATE UNIQUE INDEX channel_attestations_month_channel_uidx
  ON channel_attestations (tenant_id, month, channel);

CREATE OR REPLACE FUNCTION channel_attestations_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'channel_attestations is append-only; a later opinion is a later month''s row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER channel_attestations_no_update
  BEFORE UPDATE ON channel_attestations
  FOR EACH ROW EXECUTE FUNCTION channel_attestations_immutable();

CREATE TRIGGER channel_attestations_no_delete
  BEFORE DELETE ON channel_attestations
  FOR EACH ROW EXECUTE FUNCTION channel_attestations_immutable();

ALTER TABLE channel_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_attestations FORCE ROW LEVEL SECURITY;

CREATE POLICY channel_attestations_isolation ON channel_attestations
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON channel_attestations TO app_rw;
