-- Increment 0.4: provisioned users may sign in with password only until they
-- enroll. The TOTP secret is written during enrollment, not at provisioning.

ALTER TABLE users ALTER COLUMN mfa_secret_enc DROP NOT NULL;
