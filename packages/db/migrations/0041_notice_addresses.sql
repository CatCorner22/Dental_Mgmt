-- Increment 1.58: where a notice would go, and who may say so.
--
-- Increment 1.57 folded what each seat owes into one list, derived from rows
-- and stored nowhere. Everything in it is read rather than sent. This is the
-- first half of sending: what a message would say, and where it would go.
-- Nothing is sent yet.
--
-- The product has nowhere to send anything. `users` carries a username and a
-- display name and no address at all, which is the honest state for a system
-- whose every surface has been a screen behind a guard. An address is the
-- first thing this product has ever held whose purpose is to point outside
-- itself, and that is what shapes the table.
--
-- **Append-only, latest wins**, like the reads of Increment 1.55. An address
-- is not a setting that may be quietly overwritten: after a message goes out,
-- "what address was on file that day" is exactly the question an audit asks,
-- and an UPDATE would destroy the answer. So each act writes a row and the
-- newest row for a user is the one in force.
--
-- **A null address is a withdrawal**, recorded rather than deleted. Somebody
-- who stops wanting messages has done something, and the record of having
-- stopped is worth as much as the record of having started.
--
-- **Nobody sets anybody else's address.** This is the rule the table exists to
-- hold. An administrator who could write another person's address could
-- redirect that person's notices to themselves, silently, and the notices are
-- precisely the signal that something has gone unattended. The database
-- enforces it against `app.user_id`, the session setting every tenant
-- transaction sets, so no service path and no future caller can route around
-- it. That is stricter than the rest of the product — even a month close is
-- one person acting for the practice — and deliberately so: this is the one
-- act whose whole risk is being done on somebody else's behalf.

CREATE TABLE notice_addresses (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  /** Whose address. Never a seat: a seat is derived from the user's rank and grants, and a stored copy could disagree with them. */
  user_id uuid NOT NULL REFERENCES users(id),
  /**
   * Where a message would go, or NULL for "nowhere, and that was a decision".
   * The shape is checked here rather than in the service alone, because an
   * address that cannot receive anything is a silent failure to deliver.
   */
  address text CHECK (address IS NULL OR address ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  set_at timestamptz NOT NULL DEFAULT now()
);

-- Newest first per user, which is the only read this table has.
CREATE INDEX notice_addresses_user_idx ON notice_addresses (tenant_id, user_id, set_at DESC);

CREATE OR REPLACE FUNCTION notice_addresses_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'notice_addresses is append-only; changing an address is another row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_addresses_no_update
  BEFORE UPDATE ON notice_addresses
  FOR EACH ROW EXECUTE FUNCTION notice_addresses_immutable();

CREATE TRIGGER notice_addresses_no_delete
  BEFORE DELETE ON notice_addresses
  FOR EACH ROW EXECUTE FUNCTION notice_addresses_immutable();

-- A person sets their own address and nobody else's. `app.user_id` is set by
-- `SET_LOCAL_TENANT_SQL` at the start of every tenant transaction and dies at
-- COMMIT, so it names the caller rather than anything the caller supplied.
CREATE OR REPLACE FUNCTION notice_addresses_are_ones_own()
RETURNS trigger AS $$
DECLARE actor uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'notice_addresses: no acting user in this transaction; an address is set by the person it belongs to';
  END IF;
  IF actor <> NEW.user_id THEN
    RAISE EXCEPTION 'notice_addresses: % may not set the address of %; a person sets only their own', actor, NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_addresses_are_ones_own
  BEFORE INSERT ON notice_addresses
  FOR EACH ROW EXECUTE FUNCTION notice_addresses_are_ones_own();

-- A row names a user of this practice. Without this, the user foreign key
-- alone would admit a row pointing at another tenant's person.
CREATE OR REPLACE FUNCTION notice_addresses_match_their_tenant()
RETURNS trigger AS $$
DECLARE owner_tenant uuid;
BEGIN
  SELECT tenant_id INTO owner_tenant FROM users WHERE id = NEW.user_id;
  IF owner_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'notice_addresses: user % does not belong to this practice', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notice_addresses_match_their_tenant
  BEFORE INSERT ON notice_addresses
  FOR EACH ROW EXECUTE FUNCTION notice_addresses_match_their_tenant();

ALTER TABLE notice_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_addresses FORCE ROW LEVEL SECURITY;

CREATE POLICY notice_addresses_isolation ON notice_addresses
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON notice_addresses TO app_rw;
