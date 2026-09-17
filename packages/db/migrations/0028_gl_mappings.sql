-- Increment 1.35: the tenant's chart-of-accounts mapping, under maker-checker
-- (docs/13 item 22: "GL mapping must be tenant-editable under maker-checker or
-- the first import fails").
--
-- One row per proposal. A mapping says which account a journal line belongs to:
-- keyed by the ledger bucket, the posting kind, and the reason code ('*' means
-- any reason code for that bucket and kind). A proposal is written by one
-- person and approved by a different one; the approved row with the newest
-- approval governs. Append-only: a change is a new proposal, never an edit,
-- and a mapping is withdrawn by superseding it. The uniqueness rule permits one
-- pending proposal per key at a time, so two people cannot race the same line.

CREATE TABLE gl_mappings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  gl_bucket text NOT NULL CHECK (gl_bucket IN (
    'patient_ar', 'ins_ar_primary', 'ins_ar_secondary', 'unapplied_credit', 'undeposited_funds'
  )),
  kind text NOT NULL CHECK (kind IN (
    'charge', 'patient_payment', 'insurance_payment', 'adjustment', 'write_off',
    'refund', 'transfer_out', 'transfer_in', 'reversal'
  )),
  /** The reason code this mapping is for, or '*' for every reason code on that bucket and kind. */
  reason_code text NOT NULL DEFAULT '*' CHECK (length(btrim(reason_code)) > 0),
  account_code text NOT NULL CHECK (length(btrim(account_code)) > 0),
  account_name text NOT NULL CHECK (length(btrim(account_name)) > 0),
  side text NOT NULL CHECK (side IN ('debit', 'credit')),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
  proposed_by_id uuid NOT NULL REFERENCES users(id),
  proposed_by_name text NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  decided_by_id uuid REFERENCES users(id),
  decided_by_name text,
  decided_at timestamptz,
  supersedes_id uuid REFERENCES gl_mappings(id),
  -- A decision names a decider, and the decider is never the proposer.
  CONSTRAINT gl_mappings_decision_complete CHECK (
    (status = 'proposed' AND decided_by_id IS NULL AND decided_at IS NULL)
    OR (status <> 'proposed' AND decided_by_id IS NOT NULL AND decided_at IS NOT NULL)
  ),
  CONSTRAINT gl_mappings_maker_ne_checker CHECK (decided_by_id IS NULL OR decided_by_id <> proposed_by_id)
);

-- One pending proposal per key: a second proposer must wait for the first decision.
CREATE UNIQUE INDEX gl_mappings_pending_uidx
  ON gl_mappings (tenant_id, gl_bucket, kind, reason_code)
  WHERE status = 'proposed';
CREATE INDEX gl_mappings_tenant_key_idx ON gl_mappings (tenant_id, gl_bucket, kind, reason_code);

-- Append-only except the one decision that closes a proposal.
CREATE OR REPLACE FUNCTION gl_mappings_decide_only()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'gl_mappings is append-only';
  END IF;
  IF OLD.status <> 'proposed' THEN
    RAISE EXCEPTION 'gl_mappings row % is already decided', OLD.id;
  END IF;
  IF NEW.tenant_id <> OLD.tenant_id OR NEW.gl_bucket <> OLD.gl_bucket OR NEW.kind <> OLD.kind
     OR NEW.reason_code <> OLD.reason_code OR NEW.account_code <> OLD.account_code
     OR NEW.account_name <> OLD.account_name OR NEW.side <> OLD.side
     OR NEW.proposed_by_id <> OLD.proposed_by_id OR NEW.proposed_at <> OLD.proposed_at THEN
    RAISE EXCEPTION 'gl_mappings is append-only: propose a new mapping instead of editing one';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gl_mappings_no_delete
  BEFORE DELETE ON gl_mappings
  FOR EACH ROW EXECUTE FUNCTION gl_mappings_decide_only();

CREATE TRIGGER gl_mappings_decide_only
  BEFORE UPDATE ON gl_mappings
  FOR EACH ROW EXECUTE FUNCTION gl_mappings_decide_only();

ALTER TABLE gl_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_mappings FORCE ROW LEVEL SECURITY;

CREATE POLICY gl_mappings_isolation ON gl_mappings
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON gl_mappings TO app_rw;
