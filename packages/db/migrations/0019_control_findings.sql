-- Increment 1.22: detector findings (docs/05 "Detectors (recorded, batched)").
--
-- control_findings holds what the detectors record: one row per (kind,
-- subject), open while the condition holds, closed with a reason when it
-- clears, reopened on recurrence, never deleted. The first detector is
-- "unmatched bank lines older than 48 hours"; the other kinds named here
-- are reserved for the detectors docs/05 and docs/13 describe. detail is a
-- flat JSON object of facts about the subject; no output is phrased as an
-- accusation and no row names a person.

CREATE TABLE control_findings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  kind text NOT NULL
    CHECK (kind IN ('unmatched_bank_line_48h', 'degraded_owner_clearance', 'decision_unreviewed')),
  subject_kind text NOT NULL
    CHECK (subject_kind IN ('bank_transaction', 'reconciliation_run', 'control_decision')),
  subject_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  detail jsonb NOT NULL DEFAULT '{}',
  detector_version text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  closed_at timestamptz,
  closed_reason text,
  reopened_count integer NOT NULL DEFAULT 0,
  CONSTRAINT control_findings_closed_has_time CHECK (status <> 'closed' OR closed_at IS NOT NULL),
  CONSTRAINT control_findings_closed_has_reason
    CHECK (status <> 'closed' OR (closed_reason IS NOT NULL AND length(btrim(closed_reason)) > 0)),
  UNIQUE (tenant_id, kind, subject_kind, subject_id)
);
CREATE INDEX control_findings_tenant_status_idx ON control_findings (tenant_id, status, kind);

CREATE OR REPLACE FUNCTION control_findings_no_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'control_findings are closed, never deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER control_findings_no_delete
  BEFORE DELETE ON control_findings
  FOR EACH ROW EXECUTE FUNCTION control_findings_no_delete();

ALTER TABLE control_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_findings FORCE ROW LEVEL SECURITY;

CREATE POLICY control_findings_isolation ON control_findings
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON control_findings TO app_rw;
