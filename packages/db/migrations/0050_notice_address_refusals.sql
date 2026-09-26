-- Increment 1.67: a stranger stops a code they did not ask for.
--
-- Increment 1.61 built the proof because a signed-in person can point this
-- product's mail at an address that is not theirs, and Increment 1.63 limited
-- how often they may do it. Neither gave the person on the other end anything
-- to do about it. Five codes an hour, week after week, is still five codes an
-- hour arriving in a mailbox whose owner never heard of this practice, and the
-- only advice the message offered them was to ignore it.
--
-- Ignoring it is advice that works for the product and not for the reader. So
-- this increment gives the reader the one thing the product had never offered
-- anybody outside the practice: a way to say no, and have it hold.
--
-- **The refusal names a mailbox, not a person.** Every other row in this
-- schema names a user of the practice, because every other act here is done by
-- one. This act is done by somebody who has no account, will never have one,
-- and is not the person the message was addressed to on the practice's side.
-- What they are entitled to say is "this mailbox did not ask", and that is
-- what the row records: the address, and nothing about who typed it.
--
-- **Keyed to the address text, not to the address row.** A refusal tied to the
-- row would be escaped the same way Increment 1.63's per-row limit would have
-- been: change one character back and forth, and every new row is a fresh
-- start. The text is the thing the stranger refused, so the text is the key.
--
-- **One practice, not the product.** A cross-practice refusal list would be
-- the only table here outside the isolation every other table has, and it
-- would let one practice's reader learn that another practice mails the same
-- mailbox. What the stranger has in hand is an unwanted message from one named
-- practice, and that is exactly the scope of what this records.
--
-- **Folding happens here and only here.** Whether `Riley@Example.com` and
-- `riley@example.com` are one mailbox is decided by `lower()` in this file,
-- and the application compares through the same expression rather than folding
-- in its own language. Two implementations of one fold is two answers waiting
-- to disagree, and the disagreement would surface as a refusal the screen had
-- promised would not happen.

-- The secret that a stop link carries, stamped on the challenge whose message
-- carried it. One per message, which is what ties a refusal back to the thing
-- it refused.
--
-- It is a **second token with the opposite power**, and not the code. The code
-- is carried by hand from a mailbox into a signed-in screen and it proves; this
-- one travels in a URL a browser keeps and a proxy logs, and all it can ever do
-- is stop. Increment 1.61 refused to put a code in a link because a leaked link
-- would prove an address to whoever found it. A leaked stop link proves
-- nothing: it can only withhold, and withholding is the safe direction.
--
-- Nullable, and a null is a fact rather than an exemption: a challenge issued
-- before this increment carried no link in its message, and no value written
-- here now could change what that message said.
ALTER TABLE notice_address_challenges
  ADD COLUMN stop_hash text
    CONSTRAINT notice_address_challenges_stop_hash_is_sha256
      CHECK (stop_hash IS NULL OR stop_hash ~ '^[0-9a-f]{64}$');

CREATE INDEX notice_address_challenges_stop_idx
  ON notice_address_challenges (tenant_id, stop_hash);

CREATE TABLE notice_address_refusals (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  /** The message that provoked this, so "how do we know they were asked" has an answer. */
  challenge_id uuid NOT NULL REFERENCES notice_address_challenges(id),
  /** The mailbox that said no, as the address row held it. No user id: the person who refused is not the person who typed it. */
  address text NOT NULL,
  refused_at timestamptz NOT NULL DEFAULT now()
);

/**
 * One refusal per mailbox per practice. A second press of the same button is
 * the same statement, not a new one, and the route answers it as settled
 * rather than writing a row that says somebody decided something twice.
 */
CREATE UNIQUE INDEX notice_address_refusals_one_per_address
  ON notice_address_refusals (tenant_id, lower(address));

/**
 * A refusal names the mailbox the message it answers actually reached.
 *
 * Without this, the row would rest on the application having looked up the
 * right address, and a refusal naming some other mailbox would be indexed,
 * unique, and wrong — blocking an address nobody ever objected to. The
 * database can check this one itself, so it does.
 *
 * It reads the address row **the challenge pointed at**, never the one in
 * force now. A practice that has since moved the notices elsewhere has not
 * unsaid the message it sent, and the mailbox that received it is still the
 * mailbox that refused.
 */
CREATE OR REPLACE FUNCTION notice_address_refusals_name_where_it_went()
RETURNS trigger AS $$
DECLARE went_to text;
BEGIN
  SELECT a.address INTO went_to
    FROM notice_address_challenges c
    JOIN notice_addresses a ON a.id = c.address_id
   WHERE c.id = NEW.challenge_id AND c.tenant_id = NEW.tenant_id;
  IF went_to IS NULL THEN
    RAISE EXCEPTION 'notice_address_refusals: challenge % sent nothing this practice can name', NEW.challenge_id;
  END IF;
  IF lower(btrim(went_to)) <> lower(btrim(NEW.address)) THEN
    RAISE EXCEPTION 'notice_address_refusals: that code went to a different address';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_address_refusals_name_where_it_went
  BEFORE INSERT ON notice_address_refusals
  FOR EACH ROW EXECUTE FUNCTION notice_address_refusals_name_where_it_went();

/**
 * A refused mailbox cannot be saved as an address again.
 *
 * The refusal has to bite at the point a row is written, not only at the point
 * a message would leave. Otherwise the practice keeps a destination on file
 * that the product will never send to, the screen shows an address beside a
 * silence nobody can explain, and every list of who is reachable is wrong.
 *
 * Held here rather than in the application for the reason every rule in this
 * schema is: a check the application performs is a check a later caller can
 * skip, and this one is the only thing standing between a stranger's refusal
 * and the practice typing the same address again.
 */
CREATE OR REPLACE FUNCTION notice_addresses_not_refused()
RETURNS trigger AS $$
DECLARE refused_on timestamptz;
BEGIN
  IF NEW.address IS NULL THEN RETURN NEW; END IF;
  SELECT refused_at INTO refused_on
    FROM notice_address_refusals
   WHERE tenant_id = NEW.tenant_id AND lower(address) = lower(btrim(NEW.address))
   LIMIT 1;
  IF refused_on IS NOT NULL THEN
    RAISE EXCEPTION 'notice_addresses: somebody reading that mailbox said on % that they did not ask for this practice''s messages', refused_on;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_addresses_not_refused
  BEFORE INSERT ON notice_addresses
  FOR EACH ROW EXECUTE FUNCTION notice_addresses_not_refused();

-- Append-only, like the challenges and proofs beside it. A refusal is not
-- withdrawn: the only evidence that could authorise withdrawing it is a code
-- sent to the mailbox, and a refused mailbox is one this practice may no
-- longer send a code to. The deadlock is the guarantee. What the practice
-- keeps is the other mailbox: a person whose address was refused sets a
-- different one, and the product loses a destination rather than a person.
CREATE TRIGGER notice_address_refusals_no_update
  BEFORE UPDATE ON notice_address_refusals
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_immutable();
CREATE TRIGGER notice_address_refusals_no_delete
  BEFORE DELETE ON notice_address_refusals
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_immutable();

-- No "acting user" rule, and that absence is the increment. Every other table
-- in this group refuses a transaction with no `app.user_id`, because a person
-- proves their own address. Nobody signs in to refuse one. What authorises the
-- row is the secret the message carried, which the database cannot see and
-- will not pretend to check: a trigger asserting something about the session
-- here would assert a proxy for the rule rather than the rule.
ALTER TABLE notice_address_refusals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_address_refusals FORCE ROW LEVEL SECURITY;

CREATE POLICY notice_address_refusals_isolation ON notice_address_refusals
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON notice_address_refusals TO app_rw;
