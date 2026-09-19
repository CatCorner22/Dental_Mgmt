-- Increment 1.60: a refusal that can pass, and a refusal that cannot.
--
-- Increment 1.59 made a failed send visible. It did not make one actionable:
-- every failure read alike, so an owner facing a provider that was briefly
-- unavailable and an owner facing an address that does not exist were told the
-- same thing and given the same non-choice. One of them should ask again; the
-- other never should.
--
-- **The transport says which kind it is, because only the transport knows.**
--   transient  the refusal may pass — the provider was unavailable, busy, or
--              timed out. Asking again may get through.
--   permanent  the refusal will not pass — the address does not exist, the
--              provider rejected the message itself, or this deployment has no
--              transport at all. Asking again fails the same way.
--
-- **This is not a retry counter, and not a status.** The retrying happens in
-- the act, and every attempt it makes writes its own row, exactly as Increment
-- 1.59 laid down: how many times the practice tried is answered by counting
-- rows, never by a number beside them that the rows can contradict. What this
-- migration adds is a fact about one attempt that was true when it happened and
-- is never revised — the same thing every other column here holds.
--
-- **Why the last constraint is NOT VALID.** A failure recorded before this
-- migration genuinely does not know which kind it was. Filling one in would be
-- inventing a fact about somebody's past attempt, and guessing 'permanent'
-- would tell a reader not to try again on evidence nobody ever had. So old rows
-- keep a null and read exactly as they read in 1.59, while every failure
-- recorded from here on must say. NOT VALID is precisely that: Postgres skips
-- the scan of existing rows and enforces the check on every later insert.

ALTER TABLE notice_sends ADD COLUMN failure_kind text;

COMMENT ON COLUMN notice_sends.failure_kind IS
  'transient or permanent on a failure; null on any other outcome, and on a failure recorded before Increment 1.60 drew the distinction';

/** Two kinds, and the database refuses a third. */
ALTER TABLE notice_sends
  ADD CONSTRAINT notice_sends_failure_kind_is_one_of
  CHECK (failure_kind IS NULL OR failure_kind IN ('transient', 'permanent'));

/** Only a refusal has a kind of refusal. A send that worked has none to have. */
ALTER TABLE notice_sends
  ADD CONSTRAINT notice_sends_only_a_failure_has_a_kind
  CHECK (failure_kind IS NULL OR outcome = 'failed');

/**
 * A failure that does not say whether asking again could work leaves its reader
 * with nothing to do, which is the silence Increment 1.59 opened this table to
 * prevent. NOT VALID grandfathers the rows recorded before the distinction
 * existed rather than inventing their kind, and binds every insert after it.
 */
ALTER TABLE notice_sends
  ADD CONSTRAINT notice_sends_failure_says_which_kind
  CHECK (outcome <> 'failed' OR failure_kind IS NOT NULL) NOT VALID;
