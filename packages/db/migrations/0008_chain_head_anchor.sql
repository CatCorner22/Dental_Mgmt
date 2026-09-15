-- Increment 0.7: nightly chain heads are anchored to Object Lock storage.

ALTER TABLE audit_chain_checks ADD COLUMN object_lock_key text;

-- UPDATE needs SELECT on the target rows; RLS still limits reads to the bound tenant.
GRANT SELECT, UPDATE ON audit_chain_checks TO app_append;

CREATE OR REPLACE FUNCTION audit_chain_checks_immutable()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.object_lock_key IS NULL
       AND NEW.object_lock_key IS NOT NULL
       AND OLD.tenant_id = NEW.tenant_id
       AND OLD.day = NEW.day
       AND OLD.ok = NEW.ok
       AND OLD.head_hash = NEW.head_hash
       AND OLD.event_count = NEW.event_count
       AND OLD.checked_at = NEW.checked_at THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'audit_chain_checks is append-only';
END;
$$ LANGUAGE plpgsql;
