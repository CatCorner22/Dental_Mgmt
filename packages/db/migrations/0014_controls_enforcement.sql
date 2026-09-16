-- Increment 1.13: the database re-checks dual release on every ledger insert.
--
-- The posting service runs evaluateRelease and refuses or holds before it
-- writes. This trigger is the second lock on the same door: no code path,
-- present or future, can insert an entry that the tenant's active policy
-- says needs two people unless the row cites an approved request decided by
-- a different person, or an enabled exception in that policy that licenses
-- a single release at this amount.
--
-- What the trigger reads is the policy JSON the service reads: the channel
-- rule's enabled flag and thresholdUsd, and the exception list. It does not
-- re-implement role eligibility or force_dual / lower_threshold, which only
-- make the service stricter; the trigger is a floor, never a ceiling.

ALTER TABLE ledger_entries
  ADD COLUMN applied_exception_id text;

-- One entry per approval request.
CREATE UNIQUE INDEX ledger_entries_approval_request_uidx
  ON ledger_entries (approval_request_id)
  WHERE approval_request_id IS NOT NULL;

-- The append role inserts ledger rows and must be able to read the policy
-- and the request it cites, within its tenant binding.
GRANT SELECT ON control_policies, approval_requests TO app_append;

CREATE OR REPLACE FUNCTION ledger_release_channel(kind text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE kind
    WHEN 'adjustment' THEN 'writeoff'
    WHEN 'write_off' THEN 'writeoff'
    WHEN 'reversal' THEN 'writeoff'
    WHEN 'refund' THEN 'check'
    WHEN 'transfer_out' THEN 'ach'
    WHEN 'transfer_in' THEN 'ach'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION ledger_entries_requires_approval()
RETURNS trigger AS $$
DECLARE
  channel text := ledger_release_channel(NEW.kind);
  pol jsonb;
  rule jsonb;
  threshold_cents bigint;
  amount_cents bigint := abs(NEW.amount_cents);
  ex jsonb;
  ex_threshold_cents bigint;
  today date := current_date;
  req approval_requests%ROWTYPE;
BEGIN
  IF channel IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT policy INTO pol
    FROM control_policies
   WHERE tenant_id = NEW.tenant_id
   ORDER BY version DESC
   LIMIT 1;

  -- No policy, or the master switch off: dual release is not configured.
  IF pol IS NULL OR COALESCE((pol->>'enabled')::boolean, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT r INTO rule
    FROM jsonb_array_elements(COALESCE(pol->'rules', '[]'::jsonb)) AS r
   WHERE r->>'channel' = channel
   LIMIT 1;

  IF rule IS NULL OR COALESCE((rule->>'enabled')::boolean, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  threshold_cents := round(COALESCE((rule->>'thresholdUsd')::numeric, 0) * 100);
  IF amount_cents <= threshold_cents THEN
    RETURN NEW;
  END IF;

  -- An exception the service applied must exist in this policy, be enabled
  -- and in window, cover this channel, and license this amount.
  IF NEW.applied_exception_id IS NOT NULL THEN
    SELECT e INTO ex
      FROM jsonb_array_elements(COALESCE(pol->'exceptions', '[]'::jsonb)) AS e
     WHERE e->>'id' = NEW.applied_exception_id
     LIMIT 1;
    IF ex IS NULL THEN
      RAISE EXCEPTION 'dual_release_required: exception % is not in the active policy', NEW.applied_exception_id;
    END IF;
    IF COALESCE((ex->>'enabled')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'dual_release_required: exception % is disabled', NEW.applied_exception_id;
    END IF;
    IF (ex->>'effectiveFrom') IS NOT NULL AND today < (ex->>'effectiveFrom')::date THEN
      RAISE EXCEPTION 'dual_release_required: exception % is not yet effective', NEW.applied_exception_id;
    END IF;
    IF (ex->>'effectiveTo') IS NOT NULL AND today > (ex->>'effectiveTo')::date THEN
      RAISE EXCEPTION 'dual_release_required: exception % has expired', NEW.applied_exception_id;
    END IF;
    IF jsonb_array_length(COALESCE(ex->'channels', '[]'::jsonb)) > 0
       AND NOT (ex->'channels') ? channel THEN
      RAISE EXCEPTION 'dual_release_required: exception % does not cover channel %', NEW.applied_exception_id, channel;
    END IF;
    IF ex->>'action' = 'waive_dual' THEN
      RETURN NEW;
    END IF;
    IF ex->>'action' = 'raise_threshold' THEN
      ex_threshold_cents := round(COALESCE((ex->>'thresholdUsd')::numeric, 0) * 100);
      IF amount_cents <= ex_threshold_cents THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'dual_release_required: exception % raises the threshold only to % cents', NEW.applied_exception_id, ex_threshold_cents;
    END IF;
    RAISE EXCEPTION 'dual_release_required: exception % (%) does not license a single release', NEW.applied_exception_id, ex->>'action';
  END IF;

  IF NEW.approval_request_id IS NULL THEN
    RAISE EXCEPTION 'dual_release_required: % of % cents on channel % exceeds % cents and cites no approved request',
      NEW.kind, amount_cents, channel, threshold_cents;
  END IF;

  SELECT * INTO req FROM approval_requests WHERE id = NEW.approval_request_id;
  IF req.id IS NULL OR req.tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'dual_release_required: approval request % is not in this tenant', NEW.approval_request_id;
  END IF;
  IF req.status <> 'approved' THEN
    RAISE EXCEPTION 'dual_release_required: approval request % is %, not approved', NEW.approval_request_id, req.status;
  END IF;
  IF req.second_approver_id IS NULL OR req.second_approver_id = NEW.created_by_id THEN
    RAISE EXCEPTION 'dual_release_required: approval request % was not decided by a different person', NEW.approval_request_id;
  END IF;
  IF req.channel <> channel THEN
    RAISE EXCEPTION 'dual_release_required: approval request % is for channel %, not %', NEW.approval_request_id, req.channel, channel;
  END IF;
  IF abs(req.amount_cents) <> amount_cents THEN
    RAISE EXCEPTION 'dual_release_required: approval request % approved % cents, not %', NEW.approval_request_id, abs(req.amount_cents), amount_cents;
  END IF;
  IF req.resulting_entry_id IS NOT NULL AND req.resulting_entry_id <> NEW.id THEN
    RAISE EXCEPTION 'dual_release_required: approval request % already produced entry %', NEW.approval_request_id, req.resulting_entry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_dual_release
  BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_requires_approval();
