-- Increment 1.65: single use belongs to the code, not to the address.
--
-- Increment 1.61 made a code single-use with a unique index on `address_id`:
-- one proof per address, so a second code for an address already proved was
-- refused as answering a settled question. That worked because a proof was
-- forever.
--
-- A proof is no longer forever. It stands for a year (Increment 1.65), because
-- a mailbox somebody loses access to would otherwise stay proved and the
-- notices would keep arriving somewhere nobody reads — the same silent success
-- as a typo, merely delayed. And the moment a proof can lapse, "one proof per
-- address" stops meaning "a code is used once" and starts meaning **an address
-- can never be proved twice**, which would leave a person with a lapsed proof
-- no way back except to retype their address into a new row and lie about when
-- they chose it.
--
-- So the rule moves to where it always belonged. **A code is redeemed once**:
-- one proof per challenge. That is the property Increment 1.61 actually wanted
-- — an old code still inside its window cannot be spent twice — and it is now
-- said about the thing it is true of. An address accumulates proofs over the
-- years exactly as it accumulates anything else here, and the newest one says
-- where the proof stands.

DROP INDEX notice_address_proofs_one_per_address;

/**
 * A code proves an address once. Increment 1.61's real guarantee, moved off the
 * address and onto the code it is a fact about.
 */
CREATE UNIQUE INDEX notice_address_proofs_one_per_challenge ON notice_address_proofs (challenge_id);

-- Newest proof per address, which is the only read this table has.
CREATE INDEX notice_address_proofs_latest_idx ON notice_address_proofs (tenant_id, address_id, proved_at DESC);
