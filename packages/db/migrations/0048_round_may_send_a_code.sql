-- Increment 1.65: the product may send a code; only a person may prove.
--
-- Increment 1.61 gave both address-check tables the rule `notice_addresses`
-- holds: the acting user must be the person the row names, enforced against
-- `app.user_id`, because proving somebody else's address is the act whose whole
-- risk is being done on another person's behalf.
--
-- The scheduled round (Increment 1.62) acts for **nobody**. It runs from the
-- command line with no session, so `app.user_id` is empty — and the trigger
-- refuses that outright, which is right for a proof and wrong for a challenge.
-- Asking the round to borrow somebody's identity to send them a code would put
-- a lie in the column the rule is enforced against, and that column is the only
-- evidence the rule has.
--
-- So the rule splits along the line it was always about.
--
--   A **proof** stays strict. It must be written by the person it names, and a
--   transaction with no acting user cannot write one. Nothing here changes.
--
--   A **challenge** may also be written with no acting user at all, which is
--   the product acting for itself. It still may not be written by one person
--   for another: an actor that is present and different is refused exactly as
--   before.
--
-- That is safe because of what a challenge is. It sends a code to the address
-- already on file, which the person already proved; it confers nothing, and it
-- reaches nobody they did not choose. Every route in this product runs under a
-- guard with a real user, so "no acting user" is reachable only from a job the
-- practice runs, never from a request somebody makes.

CREATE OR REPLACE FUNCTION notice_address_challenges_are_ones_own()
RETURNS trigger AS $$
DECLARE actor uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
BEGIN
  -- No acting user: the scheduled round, asking on the product's behalf.
  IF actor IS NULL THEN RETURN NEW; END IF;
  IF actor <> NEW.user_id THEN
    RAISE EXCEPTION 'notice address checks: % may not act for %; a person asks only for their own address', actor, NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER notice_address_challenges_are_ones_own ON notice_address_challenges;

CREATE TRIGGER notice_address_challenges_are_ones_own
  BEFORE INSERT ON notice_address_challenges
  FOR EACH ROW EXECUTE FUNCTION notice_address_challenges_are_ones_own();
