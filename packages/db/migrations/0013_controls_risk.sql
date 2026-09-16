-- Increment 1.12: Precog wired to live rows.
-- sod_findings      : the current SoD conflicts from real grants, with history
-- control_decisions : append-only, owner-attributed control register
-- control_snapshots : append-only frozen scores stamped with both versions
-- user_entitlements : a grant may cite the decision that permitted it

CREATE TABLE sod_findings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  rule_id text NOT NULL,
  person_id uuid NOT NULL REFERENCES users(id),
  entitlement_a text NOT NULL,
  entitlement_b text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'family')),
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  dual_release_mitigated boolean NOT NULL DEFAULT false,
  residual_risk_accepted boolean NOT NULL DEFAULT false,
  linked_control_id text,
  conflict jsonb NOT NULL,
  rulebook_version text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  closed_at timestamptz,
  reopened_count integer NOT NULL DEFAULT 0,
  CONSTRAINT sod_findings_closed_has_time CHECK (status <> 'closed' OR closed_at IS NOT NULL),
  UNIQUE (tenant_id, rule_id, person_id)
);
CREATE INDEX sod_findings_tenant_status_idx ON sod_findings (tenant_id, status, severity);

CREATE TABLE control_decisions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  subject_kind text NOT NULL
    CHECK (subject_kind IN ('sod_finding', 'grant', 'control', 'exception', 'scenario', 'knowledge')),
  subject_id text NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('remediate', 'compensate', 'accept_residual', 'monitor', 'insure')),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  review_by date,
  residual_at_decision integer CHECK (residual_at_decision IS NULL OR (residual_at_decision >= 0 AND residual_at_decision <= 100)),
  supersedes_decision_id uuid REFERENCES control_decisions(id),
  decided_by_id uuid NOT NULL REFERENCES users(id),
  decided_by_name text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  scoring_version text NOT NULL,
  rulebook_version text NOT NULL,
  CONSTRAINT control_decisions_not_self_superseding
    CHECK (supersedes_decision_id IS NULL OR supersedes_decision_id <> id)
);
CREATE INDEX control_decisions_subject_idx
  ON control_decisions (tenant_id, subject_kind, subject_id, decided_at DESC);
CREATE INDEX control_decisions_review_idx ON control_decisions (tenant_id, review_by);

CREATE TABLE control_snapshots (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  taken_at timestamptz NOT NULL,
  trigger text NOT NULL,
  scoring_version text NOT NULL,
  rulebook_version text NOT NULL,
  average_residual integer NOT NULL,
  coso_overall integer NOT NULL,
  pressure_index integer NOT NULL,
  segregation_health integer NOT NULL,
  open_conflicts integer NOT NULL,
  conflicts_without_decision integer NOT NULL,
  snapshot jsonb NOT NULL,
  taken_by_id uuid REFERENCES users(id)
);
CREATE INDEX control_snapshots_tenant_taken_idx ON control_snapshots (tenant_id, taken_at DESC);

ALTER TABLE user_entitlements
  ADD COLUMN decision_id uuid REFERENCES control_decisions(id);

-- One live row per (tenant, person, entitlement). The grant path serializes
-- on an advisory lock; this index is the backstop that turns any remaining
-- race into a failed insert rather than a duplicate grant.
CREATE UNIQUE INDEX user_entitlements_live_uidx
  ON user_entitlements (tenant_id, user_id, entitlement)
  WHERE effective_to IS NULL;

CREATE OR REPLACE FUNCTION control_decisions_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'control_decisions is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER control_decisions_no_update
  BEFORE UPDATE ON control_decisions
  FOR EACH ROW EXECUTE FUNCTION control_decisions_immutable();

CREATE TRIGGER control_decisions_no_delete
  BEFORE DELETE ON control_decisions
  FOR EACH ROW EXECUTE FUNCTION control_decisions_immutable();

CREATE OR REPLACE FUNCTION control_snapshots_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'control_snapshots is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER control_snapshots_no_update
  BEFORE UPDATE ON control_snapshots
  FOR EACH ROW EXECUTE FUNCTION control_snapshots_immutable();

CREATE TRIGGER control_snapshots_no_delete
  BEFORE DELETE ON control_snapshots
  FOR EACH ROW EXECUTE FUNCTION control_snapshots_immutable();

-- Findings are the one mutable controls table: status flips open/closed,
-- scores refresh. They are never deleted, so history stays readable.
CREATE OR REPLACE FUNCTION sod_findings_no_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'sod_findings are closed, never deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sod_findings_no_delete
  BEFORE DELETE ON sod_findings
  FOR EACH ROW EXECUTE FUNCTION sod_findings_no_delete();

ALTER TABLE sod_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_snapshots ENABLE ROW LEVEL SECURITY;

ALTER TABLE sod_findings FORCE ROW LEVEL SECURITY;
ALTER TABLE control_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE control_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY sod_findings_isolation ON sod_findings
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY control_decisions_isolation ON control_decisions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY control_snapshots_isolation ON control_snapshots
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON sod_findings TO app_rw;
GRANT SELECT, INSERT ON control_decisions TO app_rw;
GRANT SELECT, INSERT ON control_snapshots TO app_rw;
