-- Increment 1.73: a seat whose link was lost gets another.
--
-- Increment 1.71 gave a practice the act of inviting the outside accountant's
-- seat, and 1.72 proved the invited person can finish a first sign-in. What
-- neither gave them is a second chance. `inviteAccountant` has exactly one
-- exit that creates anything, and it always creates a NEW user; a practice
-- asking to invite the same seat again is refused earlier still, by the
-- username check. The UNIQUE index this migration drops was never even
-- reached.
--
-- So a lost or expired link had one recourse: invite a different username.
-- That leaves the first account **orphaned** — active, holding the reporting
-- grant, carrying a password hash of bytes nobody kept, with an invitation
-- that has run out and cannot be reissued. Nobody can ever sign into it, and
-- because Increment 1.70 counts every active seat that could act on a notice,
-- the practice's "never set up" card would name it forever. A card that
-- accumulates entries nobody can clear is the signal that never clears, which
-- this product refuses everywhere else.
--
-- **The seat is fine; only its secret is stale.** The person is the same
-- person and the practice already decided to invite them, so the act is to
-- mint a new secret rather than to make a second seat or unmake the first.
--
-- **Newest row in force, and nothing marks the old one.** This is exactly the
-- shape `notice_addresses` has held since Increment 1.58: append-only, and the
-- last row for a subject is the one that counts. A `superseded` column would
-- be a status the rows under it could contradict, and it would have to be
-- written by whatever remembered to write it. Instead "live" is derived — an
-- invitation is live when no newer one exists for its seat and no claim row
-- names it — so **the old link stops working by construction**, on the same
-- read that finds it, rather than because a flag was set correctly.
--
-- That is why the unique index has to go: it forbade the second row that makes
-- the first one stale. What replaces it is not a weaker rule but a different
-- one, enforced in the read rather than in the index, and a live test pins it
-- by holding the old link and finding it refused.

DROP INDEX seat_invitations_one_per_seat;

-- The read this table now has: the newest invitation for one seat.
CREATE INDEX seat_invitations_newest_idx
  ON seat_invitations (tenant_id, user_id, invited_at DESC);

-- `seat_invitations_token_uidx` stays as it was. One secret still names at
-- most one invitation, which is what makes a lookup by secret unambiguous;
-- what changed is only how many invitations one seat may accumulate over time.
