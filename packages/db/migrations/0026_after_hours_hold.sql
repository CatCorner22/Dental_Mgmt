-- Increment 1.30: the database enforces the after-hours hold.
--
-- The posting service holds a refund, adjustment, or write-off posted
-- outside the location's business hours for a second person, whatever the
-- amount, by matching an hours-scoped force_dual exception in the tenant's
-- active policy. This is the second lock on that door: the trigger from
-- 0014 now also refuses such a row when it cites no approved request, so no
-- code path can post an after-hours release alone. The clock is the row's
-- posted_at in the location's own timezone; the week is locations.hours
-- from 0025. The trigger stays a floor: it enforces the hours scope only
-- for force_dual exceptions, and only when they are enabled and in window.

GRANT SELECT ON locations TO app_append;

CREATE OR REPLACE FUNCTION ledger_posted_outside_hours(p_tenant uuid, p_location uuid, p_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  loc locations%ROWTYPE;
  local_ts timestamp;
  dow text;
  win jsonb;
  hhmm text;
BEGIN
  SELECT * INTO loc FROM locations WHERE id = p_location AND tenant_id = p_tenant;
  IF loc.id IS NULL THEN
    RETURN false;
  END IF;
  local_ts := p_at AT TIME ZONE loc.timezone;
  dow := lower(to_char(local_ts, 'Dy'));
  win := loc.hours -> dow;
  IF win IS NULL OR jsonb_typeof(win) = 'null' THEN
    RETURN true;
  END IF;
  hhmm := to_char(local_ts, 'HH24:MI');
  RETURN hhmm < (win->>0) OR hhmm >= (win->>1);
END;
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
  after_hours_hold boolean := false;
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

  -- An enabled, in-window force_dual exception with the hours scope that
  -- covers this channel holds the row whatever the amount, when the row was
  -- posted outside the location's hours.
  SELECT count(*) > 0 INTO after_hours_hold
    FROM jsonb_array_elements(COALESCE(pol->'exceptions', '[]'::jsonb)) AS e
   WHERE COALESCE((e->>'enabled')::boolean, false)
     AND e->>'action' = 'force_dual'
     AND COALESCE((e->>'outsideBusinessHours')::boolean, false)
     AND (jsonb_array_length(COALESCE(e->'channels', '[]'::jsonb)) = 0 OR (e->'channels') ? channel)
     AND ((e->>'effectiveFrom') IS NULL OR today >= (e->>'effectiveFrom')::date)
     AND ((e->>'effectiveTo') IS NULL OR today <= (e->>'effectiveTo')::date);
  IF after_hours_hold THEN
    after_hours_hold := ledger_posted_outside_hours(NEW.tenant_id, NEW.location_id, NEW.posted_at);
  END IF;

  threshold_cents := round(COALESCE((rule->>'thresholdUsd')::numeric, 0) * 100);
  IF amount_cents <= threshold_cents AND NOT after_hours_hold THEN
    RETURN NEW;
  END IF;

  -- An exception the service applied must exist in this policy, be enabled
  -- and in window, cover this channel, and license this amount. It never
  -- licenses an after-hours release.
  IF NEW.applied_exception_id IS NOT NULL AND NOT after_hours_hold THEN
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
    IF after_hours_hold THEN
      RAISE EXCEPTION 'dual_release_required: % of % cents on channel % was posted outside the location''s business hours (after-hours hold) and cites no approved request',
        NEW.kind, amount_cents, channel;
    END IF;
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
