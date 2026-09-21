-- Increment 1.76: a person can re-pair their authenticator.
--
-- Until now an account's second factor was a one-way door. `mfa_enrolled_at`
-- is written once, by `completeMfaEnrollment`, and cleared nowhere; both
-- enrolment functions refuse an account that already carries it; and recovery
-- codes are a strictly decreasing supply, because the only writer that adds
-- them is that same unreachable enrolment and the only other caller removes
-- the one just burned. Ten sign-ins on recovery codes and a lost phone is a
-- permanently unreachable account — the practice owner's included.
--
-- Opening enrolment to an enrolled account is the fix, and it cannot be done
-- on this table as it stands. `setMfaPendingSecret` writes `mfa_secret_enc`
-- itself: harmless on a first enrolment, where the column is null and there is
-- no working factor to lose, and destructive on a re-pair, where merely
-- OPENING the screen would overwrite the live secret. A person who changed
-- their mind would be worse off than before they started — the countdown
-- replaced by an immediate lockout.
--
-- So a pairing in progress gets a column of its own. The live secret is
-- untouched until a code minted by the new one comes back, which is the same
-- rule the address proof holds since Increment 1.61: nothing becomes the
-- destination until somebody shows they can read from it.

ALTER TABLE users ADD COLUMN mfa_pending_secret_enc jsonb;

COMMENT ON COLUMN users.mfa_pending_secret_enc IS
  'An authenticator being paired, not yet proved. Promoted to mfa_secret_enc when a code from it verifies, and cleared then; null at rest. Never read for a sign-in.';

-- A first enrolment stages its secret here too, so the two paths are one path.
-- Any half-finished enrolment from before this migration is still sitting in
-- `mfa_secret_enc` on an account with no `mfa_enrolled_at`, which keeps working
-- exactly as it did: that account is unenrolled, so it re-stages and completes
-- through the new column on its next attempt, and nothing reads the stale one
-- because `authorize` requires `mfa_enrolled_at` before it trusts a secret.

-- Neither `auth_lookup_user` nor `auth_lookup_user_by_id` returns this column,
-- deliberately and permanently. A pairing in progress is not a factor, and the
-- lookups that resolve a person for sign-in and for a guard should be
-- incapable of handing one to anybody — not merely disciplined about it. The
-- enrolment path reads it with a query of its own, which is the only code that
-- has any business seeing it.
