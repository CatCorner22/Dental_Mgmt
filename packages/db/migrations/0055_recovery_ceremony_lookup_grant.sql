-- Increment 1.77. `auth_lookup_recovery_ceremony` has never been able to read
-- the table it selects from.
--
-- Migration 0003 taught this codebase the rule and wrote it down: FORCE ROW
-- LEVEL SECURITY binds table owners too, so a SECURITY DEFINER lookup needs
-- both a GRANT and a role-scoped SELECT policy admitting the role it runs as.
-- It did exactly that for `users` and `sessions`.
--
-- Migration 0007 then handed `auth_lookup_recovery_ceremony` to the same role
-- and granted SELECT on `recovery_ceremonies` to `app_rw` alone — so every
-- call has failed with "permission denied for table recovery_ceremonies". The
-- two-administrator recovery ceremony reads through that function to approve
-- and to consume, which means neither act has ever completed against a real
-- database.
--
-- Nothing caught it because nothing called it: the three routes had no caller
-- anywhere in the app until this increment gave them screens, and the unit
-- tests run against the memory store, which has no grants to get wrong.
GRANT SELECT ON recovery_ceremonies TO app_auth_lookup;

CREATE POLICY recovery_ceremonies_auth_lookup ON recovery_ceremonies
  FOR SELECT TO app_auth_lookup USING (true);

COMMENT ON POLICY recovery_ceremonies_auth_lookup ON recovery_ceremonies IS
  'Admits the SECURITY DEFINER lookup only. A reset token is presented with no session and no tenant context, so the row that holds its hash has to be findable across practices; the token itself is the authorisation, and the row keeps only a SHA-256 of it.';
