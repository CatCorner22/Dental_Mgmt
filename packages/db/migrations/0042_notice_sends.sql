-- Increment 1.59: sending is an act, and so is failing to send.
--
-- Increment 1.58 built the message and recorded where it would go, and sent
-- nothing. This is the other half. The table it needs is not a column on
-- anything: "notified" beside a notice would be a status the rows under it can
-- contradict the moment the thing is discharged, which is the shape this
-- codebase has refused since the owner board's counts. What a send leaves
-- behind is a record of an act, like a read (Increment 1.55) or an attestation
-- (Increment 1.51).
--
-- **A row per attempt, and an attempt that failed is still an attempt.** The
-- rule this table exists to hold is that a failed send is visible. A bounce, a
-- transport that is not configured, a provider that refuses — each is a signal
-- that did not arrive, about a practice that owed something, and a product that
-- swallowed it would be worse than one that never sent at all: the owner would
-- believe they had been told.
--
-- **Three outcomes, and only these.**
--   sent        the transport took it.
--   failed      the transport refused it, and `detail` carries its words.
--   unreachable something was owed and there was nowhere to send it — nobody
--               has given an address, or the person withdrew. Not an error, and
--               not nothing: the practice owes something and no one will hear.
--
-- Nothing owed writes no row at all. That is not an act, and a table of rows
-- saying nothing happened is a table nobody can read.
--
-- **The body is kept, not hashed.** "What did they actually receive" is the
-- question an audit asks, and the body cannot be re-derived later because it is
-- built from rows that move. It is safe to keep for the reason Increment 1.58
-- settled: `renderMessage` cannot read a person's typed words, so a body here
-- carries no patient and quotes nobody. A live case asserts that at rest.
--
-- **The address is copied in, on purpose.** `notice_addresses` is append-only
-- precisely so "what address was on file that day" survives; copying it here
-- answers the same question without a join through time, and it is the address
-- this message actually went to rather than the one in force now.

CREATE TABLE notice_sends (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  /** Whose debts the message carried. Derived from rank and grants at send time, never stored on the person. */
  seat text NOT NULL CHECK (seat IN ('owner', 'accountant')),
  recipient_id uuid NOT NULL REFERENCES users(id),
  recipient_name text NOT NULL,
  /** Where it went, as of this attempt. Null exactly when the outcome is unreachable. */
  address text,
  outcome text NOT NULL CHECK (outcome IN ('sent', 'failed', 'unreachable')),
  /** The transport's own words on a failure, or why there was nowhere to send. Null on a send that worked. */
  detail text,
  /** What the message said. Null only where there was no message to build. */
  subject text,
  body text,
  /** How many things the message named, so a reader can see a send thin out over time. */
  notice_count integer NOT NULL CHECK (notice_count >= 0),
  attempted_at timestamptz NOT NULL DEFAULT now(),

  /** A send that worked has somewhere it went and something it said. */
  CONSTRAINT notice_sends_sent_is_complete CHECK (
    outcome <> 'sent' OR (address IS NOT NULL AND subject IS NOT NULL AND body IS NOT NULL AND detail IS NULL)
  ),
  /** Nowhere to send means no address, and says why in words. */
  CONSTRAINT notice_sends_unreachable_has_no_address CHECK (
    outcome <> 'unreachable' OR (address IS NULL AND detail IS NOT NULL)
  ),
  /** A failure that does not say what failed is the silence this table exists to prevent. */
  CONSTRAINT notice_sends_failure_says_why CHECK (outcome <> 'failed' OR detail IS NOT NULL)
);

-- Newest first per person, which is the only read this table has.
CREATE INDEX notice_sends_recipient_idx ON notice_sends (tenant_id, recipient_id, attempted_at DESC);

CREATE OR REPLACE FUNCTION notice_sends_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'notice_sends is append-only; an attempt is never rewritten, and a later attempt is another row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_sends_no_update
  BEFORE UPDATE ON notice_sends
  FOR EACH ROW EXECUTE FUNCTION notice_sends_immutable();

CREATE TRIGGER notice_sends_no_delete
  BEFORE DELETE ON notice_sends
  FOR EACH ROW EXECUTE FUNCTION notice_sends_immutable();

-- A row names a person of this practice, like an address does.
CREATE OR REPLACE FUNCTION notice_sends_match_their_tenant()
RETURNS trigger AS $$
DECLARE owner_tenant uuid;
BEGIN
  SELECT tenant_id INTO owner_tenant FROM users WHERE id = NEW.recipient_id;
  IF owner_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'notice_sends: user % does not belong to this practice', NEW.recipient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_sends_match_their_tenant
  BEFORE INSERT ON notice_sends
  FOR EACH ROW EXECUTE FUNCTION notice_sends_match_their_tenant();

ALTER TABLE notice_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_sends FORCE ROW LEVEL SECURITY;

CREATE POLICY notice_sends_isolation ON notice_sends
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON notice_sends TO app_rw;
