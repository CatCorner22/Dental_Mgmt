-- Increment 1.64: what a message was, said rather than inferred.
--
-- Three kinds of message now leave this product, and until now the table told
-- them apart by a trick: a `notice_count` of zero meant the code that proves an
-- address, because a send of no notices never happens. That was true, and it
-- was still a reader inferring a fact from the absence of another. The week's
-- digest makes a third kind, and three kinds distinguished by arithmetic is a
-- table nobody can read twice the same way.
--
-- **The backfill invents nothing, and that is why it is a backfill.** Increment
-- 1.60 added `failure_kind` under a NOT VALID check precisely because the fact
-- was unknowable for rows recorded before the distinction existed — filling one
-- in would have been inventing somebody's past. Here the fact *is* knowable:
-- the product enforced, from Increment 1.59 onward, that nothing owed writes no
-- row, so a zero count names the proof code and nothing else. Reading the value
-- back out of a rule the database already held is recovering a fact, not
-- guessing one. The two migrations differ because the evidence differs.

ALTER TABLE notice_sends ADD COLUMN kind text;

UPDATE notice_sends SET kind = CASE WHEN notice_count = 0 THEN 'proof_code' ELSE 'notices' END;

ALTER TABLE notice_sends ALTER COLUMN kind SET NOT NULL;

/** Three kinds, and the database refuses a fourth. */
ALTER TABLE notice_sends
  ADD CONSTRAINT notice_sends_kind_is_one_of
  CHECK (kind IN ('notices', 'proof_code', 'digest'));

/**
 * The code that proves an address is the one message carrying no notices, and
 * the only one. Holding that here keeps the rule the backfill just read from
 * being quietly broken by a later writer.
 */
ALTER TABLE notice_sends
  ADD CONSTRAINT notice_sends_only_a_code_carries_nothing
  CHECK ((kind = 'proof_code') = (notice_count = 0));

COMMENT ON COLUMN notice_sends.kind IS
  'notices | proof_code | digest: what this message was, said rather than inferred from its notice count';

-- Newest delivered message of one kind, per person: the read the round makes
-- twice on every person it considers.
CREATE INDEX notice_sends_kind_idx ON notice_sends (tenant_id, recipient_id, kind, attempted_at DESC);

-- Increment 1.64: a round now carries two messages per person, so the counts
-- that must add up cannot also hold the digest.
--
-- `considered = sent + failed + unchanged + nothing_owed + unreachable` says
-- that every person the round looked at became exactly one outcome for their
-- notices. That is still true and still worth refusing a row that breaks. The
-- digest is a second axis over the same people, so it is counted beside that
-- sum rather than folded into it, where it would make the invariant say
-- nothing.
ALTER TABLE notice_rounds ADD COLUMN digests_sent integer NOT NULL DEFAULT 0 CHECK (digests_sent >= 0);
ALTER TABLE notice_rounds ADD COLUMN digests_failed integer NOT NULL DEFAULT 0 CHECK (digests_failed >= 0);

-- A round recorded before this increment sent no digests, because there were
-- none to send. Zero is what happened rather than what is assumed, so the
-- default comes off once the existing rows carry it.
ALTER TABLE notice_rounds ALTER COLUMN digests_sent DROP DEFAULT;
ALTER TABLE notice_rounds ALTER COLUMN digests_failed DROP DEFAULT;
