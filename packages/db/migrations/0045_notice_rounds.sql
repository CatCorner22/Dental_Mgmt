-- Increment 1.62: the round that runs without anybody pressing anything.
--
-- Everything the notices arc has built so far waits for somebody to ask. That
-- is exactly backwards: a notice exists to reach a person who is **not**
-- looking, and a product that only tells you things when you open it has told
-- you nothing you could not have found.
--
-- **The round records that it ran, and this table exists for that alone.**
-- Everywhere else this codebase refuses to write a row saying nothing
-- happened — nothing owed writes no send, and a table of such rows is a table
-- nobody can read. Here the rule inverts, for a reason that is the whole point
-- of the increment: a round that wrote nothing when it had nothing to do would
-- make **a scheduler that died indistinguishable from a practice that owes
-- nothing**, and telling those two apart is the entire job. So every round
-- writes exactly one row, including the quiet ones, and the screen can say
-- when the sender last ran.
--
-- **The counts are a record of an act, not a status.** They say what this run
-- did: how many people it considered and what became of each. They are never
-- read back as the state of anything — what each person owes is derived on
-- every read, and what reached them is in `notice_sends`.
--
-- **No acting user.** A round runs on a schedule with nobody signed in, which
-- is why this table carries none of the own-user rules `notice_addresses` and
-- the proof tables hold. Those refuse an act done on somebody's behalf; this
-- is not such an act. It reads what people already decided and sends what the
-- practice already owes, and it can put nothing new into either.

CREATE TABLE notice_rounds (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  ran_at timestamptz NOT NULL DEFAULT now(),

  /** People with an address in force. Somebody who withdrew is not considered, because they decided that. */
  considered integer NOT NULL CHECK (considered >= 0),
  /** A message left for them. */
  sent integer NOT NULL CHECK (sent >= 0),
  /** The transport refused it, and `notice_sends` carries which kind of refusal. */
  failed integer NOT NULL CHECK (failed >= 0),
  /** The message would have read exactly as the last one that reached them, and it is not yet stale. */
  unchanged integer NOT NULL CHECK (unchanged >= 0),
  /** That seat owes nothing, so there was no message to send. */
  nothing_owed integer NOT NULL CHECK (nothing_owed >= 0),
  /** An address nobody has proved, which is not a destination (Increment 1.61). */
  unreachable integer NOT NULL CHECK (unreachable >= 0),

  /**
   * Everybody considered became exactly one of these.
   *
   * A round whose counts do not account for the people it looked at is
   * reporting a shape that never happened, and a reader who trusted it would
   * be worse off than one who had no counts at all.
   */
  CONSTRAINT notice_rounds_counts_add_up
    CHECK (considered = sent + failed + unchanged + nothing_owed + unreachable)
);

-- Newest first per practice, which is the only read this table has.
CREATE INDEX notice_rounds_latest_idx ON notice_rounds (tenant_id, ran_at DESC);

CREATE OR REPLACE FUNCTION notice_rounds_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'notice_rounds is append-only; a round that ran ran, and the next one is another row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_rounds_no_update
  BEFORE UPDATE ON notice_rounds
  FOR EACH ROW EXECUTE FUNCTION notice_rounds_immutable();

CREATE TRIGGER notice_rounds_no_delete
  BEFORE DELETE ON notice_rounds
  FOR EACH ROW EXECUTE FUNCTION notice_rounds_immutable();

ALTER TABLE notice_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_rounds FORCE ROW LEVEL SECURITY;

CREATE POLICY notice_rounds_isolation ON notice_rounds
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON notice_rounds TO app_rw;
