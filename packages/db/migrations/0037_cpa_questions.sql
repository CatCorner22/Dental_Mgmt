-- Increment 1.50: the accountant asks about a line, and the practice answers
-- (docs/13 item 22's question verb).
--
-- The month-end package is aggregate and hash-stamped, and until now it was
-- one-way: the outside accountant could read it and export it, and had no way
-- to ask about a figure except email, where the question and its answer leave
-- no record beside the month they are about.
--
-- One append-only table holds both halves. A thread is the message that opened
-- it plus every message after; `thread_id` points at the opening message, and
-- the opening message points at itself, so a thread is one indexed read and
-- there is no second table to keep in step. Nothing is ever edited or deleted:
-- an answer that was wrong is followed by another message, exactly as a
-- correction follows a posting rather than replacing it.
--
-- `subject_key` is the package line the thread hangs on — the section and key
-- `packageRows` gives every row — so a question names a figure the package
-- states rather than floating beside it. The service refuses a subject the
-- month's package does not contain; the column stays free text because the
-- package's shape is versioned (`package_schema`) and a thread outlives the
-- shape it was asked under.
--
-- `author_seat` records which side spoke, because that is what decides whether
-- the practice still owes an answer. It is not a rank: the same person may hold
-- a rank and not the seat.

CREATE TABLE cpa_thread_messages (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  thread_id uuid NOT NULL,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  subject_key text NOT NULL CHECK (length(btrim(subject_key)) > 0),
  body text NOT NULL CHECK (length(btrim(body)) >= 10),
  author_seat text NOT NULL CHECK (author_seat IN ('accountant', 'practice')),
  author_id uuid NOT NULL REFERENCES users(id),
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cpa_thread_messages_thread_idx ON cpa_thread_messages (tenant_id, thread_id, created_at);
CREATE INDEX cpa_thread_messages_month_idx ON cpa_thread_messages (tenant_id, month);

CREATE OR REPLACE FUNCTION cpa_thread_messages_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'cpa_thread_messages is append-only; a message is answered, never edited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cpa_thread_messages_no_update
  BEFORE UPDATE ON cpa_thread_messages
  FOR EACH ROW EXECUTE FUNCTION cpa_thread_messages_immutable();

CREATE TRIGGER cpa_thread_messages_no_delete
  BEFORE DELETE ON cpa_thread_messages
  FOR EACH ROW EXECUTE FUNCTION cpa_thread_messages_immutable();

-- A reply names a thread that opens in this practice, and carries that thread's
-- month and subject. The database holds this rather than the service alone: a
-- thread id pointing nowhere would leave a message no reader could reach, and a
-- reply filed under another month would answer a figure it is not about.
CREATE OR REPLACE FUNCTION cpa_thread_messages_joins_its_thread()
RETURNS trigger AS $$
DECLARE opener cpa_thread_messages%ROWTYPE;
BEGIN
  IF NEW.thread_id = NEW.id THEN
    RETURN NEW;
  END IF;
  SELECT * INTO opener FROM cpa_thread_messages
  WHERE tenant_id = NEW.tenant_id AND id = NEW.thread_id AND id = thread_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cpa_thread_messages: thread % does not open in this practice', NEW.thread_id;
  END IF;
  IF NEW.month <> opener.month OR NEW.subject_key <> opener.subject_key THEN
    RAISE EXCEPTION 'cpa_thread_messages: a reply carries its thread''s month and subject';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cpa_thread_messages_joins_its_thread
  BEFORE INSERT ON cpa_thread_messages
  FOR EACH ROW EXECUTE FUNCTION cpa_thread_messages_joins_its_thread();

ALTER TABLE cpa_thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpa_thread_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY cpa_thread_messages_isolation ON cpa_thread_messages
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON cpa_thread_messages TO app_rw;
