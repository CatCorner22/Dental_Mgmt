-- Increment 1.61: proving that an address reaches the person who typed it.
--
-- Increment 1.58 recorded where a person's notices would go and held one rule
-- about it: a person sets their own address and nobody else's, enforced by the
-- database against `app.user_id`, because an administrator who could write
-- somebody else's address could redirect the very signal that says something
-- has gone unattended.
--
-- That rule stops one person redirecting another's notices. It does not stop a
-- person redirecting their own into a typo, and the typo is the likelier
-- accident: `riley@ridgeveiw.example` passes every shape check there is, and
-- reaches either nobody or a stranger. Increment 1.59 made a failed send
-- visible — but a message accepted by a real mailbox belonging to somebody
-- else does not fail. It succeeds, and it succeeds silently, which is the one
-- outcome this whole arc exists to prevent.
--
-- So the product stops taking the practice's word for it. A code goes to the
-- address; the person brings it back; the coming back is the proof.
--
-- **Two tables, because a secret and a fact are not the same thing.** A
-- challenge holds a secret and expires. A proof holds neither: it is a fact
-- about one address row, true forever after, with nothing in it worth keeping
-- from anybody. Putting them in one table would give the fact the secret's
-- lifetime and the secret the fact's permanence, and both are wrong.
--
-- **The proof belongs to the address row, not to the person.** `notice_addresses`
-- is append-only and newest-row-wins, so changing an address writes a new row
-- with a new id — which no proof points at. A person who changes their address
-- is therefore unproved again by construction, with no flag to clear and no
-- code that can be left stale. This codebase's rule is that a signal which
-- never clears is not a signal; here the signal clears because of the shape
-- rather than because something remembers to clear it.
--
-- **The code is stored as a hash, never in the clear.** It went out in a
-- message, so it is a bearer secret for as long as it lives. What the database
-- keeps is enough to recognise the right code and not enough to produce one.

-- The composite keys the two tables below point through. Both are trivially
-- unique already (id is the primary key); naming them lets a foreign key carry
-- "and it is the same person's" and "and it is the same address" declaratively,
-- rather than in a trigger somebody could forget to write.
ALTER TABLE notice_addresses ADD CONSTRAINT notice_addresses_id_user UNIQUE (id, user_id);

CREATE TABLE notice_address_challenges (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  /** The exact address row this code was sent to, so a later address is not proved by an earlier code. */
  address_id uuid NOT NULL,
  /** SHA-256 of the code, hex. The code itself exists only in the message. */
  token_hash text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,

  /** A code that expires before it is issued could never be used, and a row claiming otherwise is a bug recorded as data. */
  CONSTRAINT notice_address_challenges_expires_after_issue CHECK (expires_at > issued_at),
  /** The address belongs to the person the code was sent for. */
  CONSTRAINT notice_address_challenges_address_is_theirs
    FOREIGN KEY (address_id, user_id) REFERENCES notice_addresses (id, user_id),
  /** Lets a proof name the challenge it answers and the address in one key. */
  CONSTRAINT notice_address_challenges_id_address UNIQUE (id, address_id)
);

CREATE INDEX notice_address_challenges_lookup_idx
  ON notice_address_challenges (tenant_id, user_id, token_hash);

CREATE TABLE notice_address_proofs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  address_id uuid NOT NULL,
  /** Which code proved it, so "how do we know" has an answer rather than a date. */
  challenge_id uuid NOT NULL,
  proved_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notice_address_proofs_address_is_theirs
    FOREIGN KEY (address_id, user_id) REFERENCES notice_addresses (id, user_id),
  /** The challenge answered is one issued for this same address. */
  CONSTRAINT notice_address_proofs_answers_its_own_challenge
    FOREIGN KEY (challenge_id, address_id) REFERENCES notice_address_challenges (id, address_id)
);

/**
 * One proof per address, which is what makes a code single-use: once an
 * address is proved, every later code for it is refused as answering a
 * question already settled. A second proof could otherwise be written from an
 * older code that is still inside its window.
 */
CREATE UNIQUE INDEX notice_address_proofs_one_per_address ON notice_address_proofs (address_id);

/**
 * A proof cannot be stamped after the code it answers had expired.
 *
 * The check reads the proof's own stamp rather than `now()`, so it says what it
 * means — this proof happened inside that window — and stays true for a caller
 * that supplies the time rather than taking the clock's.
 */
CREATE OR REPLACE FUNCTION notice_address_proofs_are_in_time()
RETURNS trigger AS $$
DECLARE window_ends timestamptz;
BEGIN
  SELECT expires_at INTO window_ends FROM notice_address_challenges WHERE id = NEW.challenge_id;
  IF NEW.proved_at > window_ends THEN
    RAISE EXCEPTION 'notice_address_proofs: that code expired on %; ask for another', window_ends;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_address_proofs_are_in_time
  BEFORE INSERT ON notice_address_proofs
  FOR EACH ROW EXECUTE FUNCTION notice_address_proofs_are_in_time();

-- Both tables are append-only, for the reason every other record of an act
-- here is: a challenge that was issued was issued, and a proof that happened
-- happened. Asking again writes another challenge.
CREATE OR REPLACE FUNCTION notice_address_checks_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'notice address challenges and proofs are append-only; asking again is another row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_address_challenges_no_update
  BEFORE UPDATE ON notice_address_challenges
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_immutable();
CREATE TRIGGER notice_address_challenges_no_delete
  BEFORE DELETE ON notice_address_challenges
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_immutable();
CREATE TRIGGER notice_address_proofs_no_update
  BEFORE UPDATE ON notice_address_proofs
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_immutable();
CREATE TRIGGER notice_address_proofs_no_delete
  BEFORE DELETE ON notice_address_proofs
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_immutable();

-- A person asks for their own code and proves their own address, exactly as
-- they set their own address: this is the same act with the same whole risk.
CREATE OR REPLACE FUNCTION notice_address_checks_are_ones_own()
RETURNS trigger AS $$
DECLARE actor uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'notice address checks: no acting user in this transaction; a person proves their own address';
  END IF;
  IF actor <> NEW.user_id THEN
    RAISE EXCEPTION 'notice address checks: % may not act for %; a person proves only their own address', actor, NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_address_challenges_are_ones_own
  BEFORE INSERT ON notice_address_challenges
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_are_ones_own();
CREATE TRIGGER notice_address_proofs_are_ones_own
  BEFORE INSERT ON notice_address_proofs
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_are_ones_own();

-- A row names a user of this practice, as every other tenant table's does.
CREATE OR REPLACE FUNCTION notice_address_checks_match_their_tenant()
RETURNS trigger AS $$
DECLARE owner_tenant uuid;
BEGIN
  SELECT tenant_id INTO owner_tenant FROM users WHERE id = NEW.user_id;
  IF owner_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'notice address checks: user % does not belong to this practice', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_address_challenges_match_their_tenant
  BEFORE INSERT ON notice_address_challenges
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_match_their_tenant();
CREATE TRIGGER notice_address_proofs_match_their_tenant
  BEFORE INSERT ON notice_address_proofs
  FOR EACH ROW EXECUTE FUNCTION notice_address_checks_match_their_tenant();

ALTER TABLE notice_address_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_address_challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE notice_address_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_address_proofs FORCE ROW LEVEL SECURITY;

CREATE POLICY notice_address_challenges_isolation ON notice_address_challenges
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY notice_address_proofs_isolation ON notice_address_proofs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON notice_address_challenges TO app_rw;
GRANT SELECT, INSERT ON notice_address_proofs TO app_rw;
