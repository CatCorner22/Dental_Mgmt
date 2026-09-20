-- Increment 1.66: a fourth kind of message, and a third axis on a round.
--
-- The outside accountant's seat reaches the month-end package and nothing else
-- (Increment 1.49), and until now learned that a month had closed only by
-- signing in to look. The practice closes a month; the person whose whole job
-- begins at that moment is not told. That is the same gap the notices arc has
-- been closing since Increment 1.57, met at the one place where the reader is
-- not a member of the practice at all.

ALTER TABLE notice_sends DROP CONSTRAINT notice_sends_kind_is_one_of;

/** Four kinds, and the database still refuses a fifth. */
ALTER TABLE notice_sends
  ADD CONSTRAINT notice_sends_kind_is_one_of
  CHECK (kind IN ('notices', 'proof_code', 'digest', 'package'));

-- A third axis over the same people, counted beside the sum that must add up
-- rather than inside it, for the reason Increment 1.64 gave about the digest:
-- `considered = sent + failed + unchanged + nothing_owed + unreachable` says
-- every person became exactly one **notices** outcome, and a second or third
-- message to the same person folded into it would make the invariant say
-- nothing about anything.
--
-- A round recorded before this increment sent no package messages, because
-- there were none to send. Zero is what happened rather than what is assumed,
-- so the default comes off once the existing rows carry it.
ALTER TABLE notice_rounds ADD COLUMN packages_sent integer NOT NULL DEFAULT 0 CHECK (packages_sent >= 0);
ALTER TABLE notice_rounds ADD COLUMN packages_failed integer NOT NULL DEFAULT 0 CHECK (packages_failed >= 0);

ALTER TABLE notice_rounds ALTER COLUMN packages_sent DROP DEFAULT;
ALTER TABLE notice_rounds ALTER COLUMN packages_failed DROP DEFAULT;
