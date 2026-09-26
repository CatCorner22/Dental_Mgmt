-- Increment 1.55: the accountant learns that an answer landed.
--
-- Increment 1.50 made the month-end package two-way: the accountant asks about
-- a line and the practice answers from the owner board. The practice learns it
-- owes an answer, because the board reads the last message's seat and shows
-- what is owed. The accountant learns nothing: an answer lands in a thread on a
-- screen nobody is watching, and the only way to find it is to re-read every
-- thread of every month.
--
-- The obvious fix — a badge on `/cpa` for any thread the practice answered —
-- is worse than nothing, because it never clears. A signal that is always on is
-- not a signal. What clears it is a record that somebody read the answer, and
-- that record is worth keeping on its own: an accountant closing a month-end
-- file is asserting they saw what the practice said, which is exactly the sort
-- of assertion the rest of this product records rather than assumes.
--
-- So reading is an act, stamped like the digest acknowledgment of Increment
-- 1.28 rather than inferred from a page view. A GET that writes would make the
-- record a side effect of loading a screen, which is not the same claim.
--
-- Append-only, and deliberately not unique: a thread is read again whenever it
-- grows, so a seat has many read rows over a thread's life and the latest one
-- wins. `up_to_message_id` is what the reader had in front of them, so a later
-- message re-opens the signal without any row being rewritten.

CREATE TABLE cpa_thread_reads (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  thread_id uuid NOT NULL,
  /** Which side read it. Not a rank: the same person may hold a rank and not the seat. */
  seat text NOT NULL CHECK (seat IN ('accountant', 'practice')),
  /** The last message the reader had in front of them. A later one re-opens the signal. */
  up_to_message_id uuid NOT NULL REFERENCES cpa_thread_messages(id),
  reader_id uuid NOT NULL REFERENCES users(id),
  reader_name text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cpa_thread_reads_thread_idx ON cpa_thread_reads (tenant_id, thread_id, seat, read_at DESC);

CREATE OR REPLACE FUNCTION cpa_thread_reads_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'cpa_thread_reads is append-only; reading again is another row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cpa_thread_reads_no_update
  BEFORE UPDATE ON cpa_thread_reads
  FOR EACH ROW EXECUTE FUNCTION cpa_thread_reads_immutable();

CREATE TRIGGER cpa_thread_reads_no_delete
  BEFORE DELETE ON cpa_thread_reads
  FOR EACH ROW EXECUTE FUNCTION cpa_thread_reads_immutable();

-- A read names a message of the thread it claims to have read, in this
-- practice. The database holds this rather than the service alone: a read
-- pointing at another thread's message would clear a signal about a
-- conversation the reader never saw.
CREATE OR REPLACE FUNCTION cpa_thread_reads_match_their_thread()
RETURNS trigger AS $$
DECLARE msg cpa_thread_messages%ROWTYPE;
BEGIN
  SELECT * INTO msg FROM cpa_thread_messages
  WHERE tenant_id = NEW.tenant_id AND id = NEW.up_to_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cpa_thread_reads: message % is not this practice''s', NEW.up_to_message_id;
  END IF;
  IF msg.thread_id <> NEW.thread_id THEN
    RAISE EXCEPTION 'cpa_thread_reads: message % belongs to thread %, not %', NEW.up_to_message_id, msg.thread_id, NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cpa_thread_reads_match_their_thread
  BEFORE INSERT ON cpa_thread_reads
  FOR EACH ROW EXECUTE FUNCTION cpa_thread_reads_match_their_thread();

ALTER TABLE cpa_thread_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpa_thread_reads FORCE ROW LEVEL SECURITY;

CREATE POLICY cpa_thread_reads_isolation ON cpa_thread_reads
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON cpa_thread_reads TO app_rw;
