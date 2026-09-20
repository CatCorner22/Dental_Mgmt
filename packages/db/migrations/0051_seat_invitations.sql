-- Increment 1.71: the practice invites the seat it cannot otherwise create.
--
-- The question this answers was asked as "an address for somebody who is not a
-- user", because `notice_addresses.user_id` is a foreign key into `users` and
-- a firm's shared mailbox is not a person. The answer is no, and the reason is
-- not the foreign key.
--
-- A destination with no person behind it would be a **second kind of
-- recipient** standing beside the seat. It would need its own proof that the
-- mailbox consents (Increment 1.61), its own way for a stranger to refuse
-- (1.67), its own place in the reading of who cannot be reached (1.69), and
-- its own place in the reading of who was never set up (1.70) — four second
-- answers to questions the seat already answers. This schema refuses second
-- answers everywhere else, and the refusal is worth more here than most: two
-- notions of "recipient" would eventually disagree about who was told what.
--
-- What a shared mailbox actually wants is to **be** the recipient, and this
-- product's word for a recipient is a seat (Increment 1.49). Nothing stops
-- `accounting@firm.example` holding the outside accountant's seat, proving its
-- own address, being told when a month closes, or refusing — except that the
-- practice has no way to create the seat. `users` is written by the seed and
-- by nothing else in the product. So the gap was never an address for a
-- non-user; it was the act of adding the person.
--
-- **The practice names the seat; the person supplies the secret.** This is
-- Increment 1.58's rule turned around, and it is the same rule: an address is
-- set by the person it belongs to, so a password is set by the person it
-- belongs to. The practice never learns it. The row it creates carries a hash
-- of bytes nobody kept, so the account exists and no password opens it until
-- its holder chooses one.
--
-- **The ask and the answer are two tables**, as a challenge and a proof are
-- (Increment 1.61). A `claimed_at` column would be a status the rows under it
-- could contradict and an UPDATE on an otherwise append-only table; a claim
-- row is a fact that cannot be unwritten.
--
-- **The invitation is spent by being used, and it expires.** Seven days, short
-- because unlike a stop link this secret *opens an account*: it is the one
-- token in this product whose leak hands somebody a seat rather than taking
-- one away.

CREATE TABLE seat_invitations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  /** The seat this invitation was created alongside. One invitation, one seat. */
  user_id uuid NOT NULL REFERENCES users(id),
  /** sha256 of the secret the link carries. The secret itself is never stored. */
  token_hash text NOT NULL
    CONSTRAINT seat_invitations_token_hash_is_sha256 CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  /** Who acted for the practice. Never null: an invitation is somebody's act. */
  invited_by uuid NOT NULL REFERENCES users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT seat_invitations_expire_after_issue CHECK (expires_at > invited_at)
);

-- One live invitation per seat. Re-inviting a seat whose invitation is spent is
-- another row; two live ones would be two secrets opening one account.
CREATE UNIQUE INDEX seat_invitations_one_per_seat ON seat_invitations (tenant_id, user_id);
CREATE UNIQUE INDEX seat_invitations_token_uidx ON seat_invitations (token_hash);

/**
 * That the invitation was used, and when. Separate from the ask for the reason
 * a proof is separate from a challenge: a status column on the ask would be an
 * UPDATE on an append-only table and a fact that could be rewritten.
 */
CREATE TABLE seat_invitation_claims (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  invitation_id uuid NOT NULL REFERENCES seat_invitations(id),
  claimed_at timestamptz NOT NULL DEFAULT now()
);

-- One claim per invitation. The secret opens the account once.
CREATE UNIQUE INDEX seat_invitation_claims_one_per_invitation ON seat_invitation_claims (invitation_id);

CREATE OR REPLACE FUNCTION seat_invitations_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'seat invitations are append-only; an invitation is spent by a claim row, never by an update';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seat_invitations_no_update
  BEFORE UPDATE ON seat_invitations
  FOR EACH ROW EXECUTE FUNCTION seat_invitations_immutable();
CREATE TRIGGER seat_invitations_no_delete
  BEFORE DELETE ON seat_invitations
  FOR EACH ROW EXECUTE FUNCTION seat_invitations_immutable();
CREATE TRIGGER seat_invitation_claims_no_update
  BEFORE UPDATE ON seat_invitation_claims
  FOR EACH ROW EXECUTE FUNCTION seat_invitations_immutable();
CREATE TRIGGER seat_invitation_claims_no_delete
  BEFORE DELETE ON seat_invitation_claims
  FOR EACH ROW EXECUTE FUNCTION seat_invitations_immutable();

-- Both rows name people of this practice. The foreign keys alone would admit a
-- row pointing at another tenant's person, which is the same hole Increment
-- 1.58 closed on `notice_addresses`.
CREATE OR REPLACE FUNCTION seat_invitations_match_their_tenant()
RETURNS trigger AS $$
DECLARE seat_tenant uuid; actor_tenant uuid;
BEGIN
  SELECT tenant_id INTO seat_tenant FROM users WHERE id = NEW.user_id;
  IF seat_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'seat_invitations: user % does not belong to this practice', NEW.user_id;
  END IF;
  SELECT tenant_id INTO actor_tenant FROM users WHERE id = NEW.invited_by;
  IF actor_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'seat_invitations: user % does not belong to this practice', NEW.invited_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seat_invitations_match_their_tenant
  BEFORE INSERT ON seat_invitations
  FOR EACH ROW EXECUTE FUNCTION seat_invitations_match_their_tenant();

-- An invitation is somebody's act, so the acting user has to be there and has
-- to be the one named. This is the `notice_addresses` rule read the other way:
-- there, nobody may act for another person; here, nobody may record another
-- person as having invited.
CREATE OR REPLACE FUNCTION seat_invitations_name_their_actor()
RETURNS trigger AS $$
DECLARE actor uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'seat_invitations: no acting user in this transaction; an invitation is somebody''s act';
  END IF;
  IF actor <> NEW.invited_by THEN
    RAISE EXCEPTION 'seat_invitations: % may not record % as the inviter', actor, NEW.invited_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seat_invitations_name_their_actor
  BEFORE INSERT ON seat_invitations
  FOR EACH ROW EXECUTE FUNCTION seat_invitations_name_their_actor();

-- A claim has no acting-user rule, and the absence is deliberate in the same
-- way Increment 1.67's was: the person claiming has no account yet, which is
-- the whole point of the act. What authorises the row is the secret the link
-- carried, which the database cannot see and will not pretend to check.
CREATE OR REPLACE FUNCTION seat_invitation_claims_match_their_tenant()
RETURNS trigger AS $$
DECLARE ask_tenant uuid;
BEGIN
  SELECT tenant_id INTO ask_tenant FROM seat_invitations WHERE id = NEW.invitation_id;
  IF ask_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'seat_invitation_claims: invitation % does not belong to this practice', NEW.invitation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seat_invitation_claims_match_their_tenant
  BEFORE INSERT ON seat_invitation_claims
  FOR EACH ROW EXECUTE FUNCTION seat_invitation_claims_match_their_tenant();

ALTER TABLE seat_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE seat_invitation_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_invitation_claims FORCE ROW LEVEL SECURITY;

CREATE POLICY seat_invitations_isolation ON seat_invitations
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY seat_invitation_claims_isolation ON seat_invitation_claims
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON seat_invitations TO app_rw;
GRANT SELECT, INSERT ON seat_invitation_claims TO app_rw;
