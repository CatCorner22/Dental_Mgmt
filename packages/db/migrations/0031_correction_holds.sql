-- Increment 1.38: one approval releases a correction pair.
--
-- Increment 1.37 wrote the pair in one transaction and refused a correction
-- whose figure needed a second person, because the dual-release trigger
-- (migration 0014) admits one row per approved request at exactly the
-- approved amount, and a pair is two rows at two amounts. Refusing was safe
-- and honest, but it left the practice no way to correct a large entry.
--
-- The rule the trigger learns here: an approval may name the entry being
-- corrected, and then it releases both halves of that one correction —
-- neither of which may exceed the figure the second person approved.

ALTER TABLE approval_requests ADD COLUMN corrects_entry_id uuid REFERENCES ledger_entries(id);

CREATE INDEX approval_requests_tenant_corrects_idx
  ON approval_requests (tenant_id, corrects_entry_id)
  WHERE corrects_entry_id IS NOT NULL;

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
  -- A correction hold (Increment 1.38): the second person approved one
  -- correction of one entry, at the larger of its two figures. Both halves
  -- post under it, and neither may exceed what was approved.
  IF req.corrects_entry_id IS NOT NULL THEN
    IF NEW.corrects_entry_id IS DISTINCT FROM req.corrects_entry_id THEN
      RAISE EXCEPTION 'dual_release_required: approval request % releases the correction of entry %, not this row',
        NEW.approval_request_id, req.corrects_entry_id;
    END IF;
    IF amount_cents > abs(req.amount_cents) THEN
      RAISE EXCEPTION 'dual_release_required: approval request % approved up to % cents, and this half is %',
        NEW.approval_request_id, abs(req.amount_cents), amount_cents;
    END IF;
    RETURN NEW;
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

-- Migration 0014 held one entry per approval request with a unique index. A
-- correction hold releases exactly two, one of each kind, so the guarantee is
-- restated rather than dropped: one row per ordinary approval, and one row per
-- kind per correction approval — which admits the reversal and its repost, and
-- nothing else.
DROP INDEX ledger_entries_approval_request_uidx;

CREATE UNIQUE INDEX ledger_entries_approval_request_uidx
  ON ledger_entries (approval_request_id)
  WHERE approval_request_id IS NOT NULL AND corrects_entry_id IS NULL;

CREATE UNIQUE INDEX ledger_entries_correction_approval_uidx
  ON ledger_entries (approval_request_id, kind)
  WHERE approval_request_id IS NOT NULL AND corrects_entry_id IS NOT NULL;
