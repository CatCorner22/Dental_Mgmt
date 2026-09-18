-- Increment 1.46: a reason code may tighten the dual-release threshold.
--
-- `reason_codes.requires_approval_over_cents` has existed since migration 0010
-- and nothing has ever read it, so every row carries the default 0 — a figure
-- that meant nothing. Left as it was, 0 is ambiguous: it reads either as "no
-- reason-specific rule" or as "hold every one of these". The column becomes
-- nullable so the two are different facts:
--
--   NULL  the practice set no rule for this reason; the channel's threshold governs
--   0     every posting under this reason waits for a second person
--   N     a second person above N cents
--
-- The backfill sets every existing row to NULL, which is the truth about them:
-- nothing read the column, so no practice ever expressed a rule through it.
--
-- The effective threshold is least(channel, reason). A reason only ever
-- tightens, because a reason that could loosen would let a practice undo dual
-- release by inventing one — the control this whole path exists to hold.
--
-- The exception path is deliberately untouched. A raise_threshold exception is
-- a governed decision with a review date behind it (Increment 1.31), so it
-- still licenses up to its own figure; the reason threshold decides whether a
-- hold is needed at all, not what an exception may license.

ALTER TABLE reason_codes ALTER COLUMN requires_approval_over_cents DROP NOT NULL;
ALTER TABLE reason_codes ALTER COLUMN requires_approval_over_cents DROP DEFAULT;
UPDATE reason_codes SET requires_approval_over_cents = NULL WHERE requires_approval_over_cents = 0;

ALTER TABLE reason_codes ADD CONSTRAINT reason_codes_threshold_not_negative
  CHECK (requires_approval_over_cents IS NULL OR requires_approval_over_cents >= 0);

-- The trigger now reads reason_codes on every guarded insert, and the held
-- release path inserts as app_append, exactly as migration 0026 needed
-- locations, 0029 month_closes, and 0032 day_closes.
GRANT SELECT ON reason_codes TO app_append;

-- The whole current function carried forward from migration 0031 — the
-- after-hours hold and the correction branch included — with the reason
-- threshold inserted. Rebuilding it from an older migration's text would
-- silently revert both.

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
  reason_threshold_cents bigint;
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

  -- A reason the practice holds to a stricter figure tightens the channel's
  -- threshold for this row, and only ever tightens it (Increment 1.46). NULL
  -- means the practice set no reason-specific rule, so the channel governs; 0
  -- means every posting under that reason waits for a second person. least()
  -- is the whole rule: a reason can never license what the channel would hold,
  -- or a practice could loosen dual release by inventing a reason.
  IF NEW.reason_code IS NOT NULL THEN
    SELECT requires_approval_over_cents INTO reason_threshold_cents
      FROM reason_codes
     WHERE tenant_id = NEW.tenant_id AND code = NEW.reason_code;
    IF reason_threshold_cents IS NOT NULL THEN
      threshold_cents := least(threshold_cents, reason_threshold_cents);
    END IF;
  END IF;

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
