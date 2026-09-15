-- Increment 0.3: a per-tenant sequence number defines chain order.
-- occurred_at alone cannot: two events in one millisecond have no order, so
-- writer and verifier could disagree, and two concurrent appends could both
-- name the same prev_hash and fork the chain without any constraint firing.
-- UNIQUE (tenant_id, seq) makes the second writer fail instead.

-- FORCE RLS hides every row from the migrator; lift it for the backfill only.
ALTER TABLE domain_event DISABLE ROW LEVEL SECURITY;

ALTER TABLE domain_event ADD COLUMN seq bigint;

UPDATE domain_event d
   SET seq = s.rn
  FROM (
    SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY occurred_at, id) AS rn
      FROM domain_event
  ) s
 WHERE d.id = s.id;

ALTER TABLE domain_event ALTER COLUMN seq SET NOT NULL;
ALTER TABLE domain_event ADD CONSTRAINT domain_event_seq_positive CHECK (seq >= 1);
CREATE UNIQUE INDEX domain_event_tenant_seq_uidx ON domain_event (tenant_id, seq);

ALTER TABLE domain_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_event FORCE ROW LEVEL SECURITY;
