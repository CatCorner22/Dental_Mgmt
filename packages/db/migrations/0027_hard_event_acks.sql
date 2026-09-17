-- Increment 1.33: the owner's acknowledgment of a hard event (docs/01 item 14).
--
-- The six hard events are read from rows on every read and never stored;
-- what is stored is the owner's answer to one of them: which event (its
-- kind and the row it names), when it happened, what was done about it,
-- who acknowledged it and when. One acknowledgment per event; append-only;
-- never deleted. The note must say something: at least ten characters.

CREATE TABLE hard_event_acks (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  kind text NOT NULL CHECK (kind IN (
    'after_hours_refund', 'retroactive_entry', 'waived_dual_control',
    'deposit_variance', 'chain_failure', 'new_device_financial_role'
  )),
  subject_kind text NOT NULL CHECK (length(subject_kind) > 0),
  subject_id text NOT NULL CHECK (length(subject_id) > 0),
  event_at timestamptz NOT NULL,
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  acknowledged_by_id uuid NOT NULL REFERENCES users(id),
  acknowledged_by_name text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, subject_kind, subject_id)
);

CREATE OR REPLACE FUNCTION hard_event_acks_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'hard_event_acks is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hard_event_acks_no_update
  BEFORE UPDATE ON hard_event_acks
  FOR EACH ROW EXECUTE FUNCTION hard_event_acks_immutable();

CREATE TRIGGER hard_event_acks_no_delete
  BEFORE DELETE ON hard_event_acks
  FOR EACH ROW EXECUTE FUNCTION hard_event_acks_immutable();

ALTER TABLE hard_event_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hard_event_acks FORCE ROW LEVEL SECURITY;

CREATE POLICY hard_event_acks_isolation ON hard_event_acks
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON hard_event_acks TO app_rw;
