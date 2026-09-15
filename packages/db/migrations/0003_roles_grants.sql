-- Increment 0.3: the roles documented in 0001 get real grants.
-- Roles are created once per database by sql/roles.sql; this file refuses to
-- run without them rather than silently granting to nobody.

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['app_rw', 'app_append', 'app_auth_lookup', 'app_verify']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      RAISE EXCEPTION 'role % does not exist; run packages/db/sql/roles.sql first', r;
    END IF;
  END LOOP;
END
$$;

-- Runtime role. Mutable tables may be read, inserted, and updated. Nothing is
-- deleted: users are deactivated, sessions are revoked.
GRANT SELECT, INSERT, UPDATE ON tenants, locations, users, sessions, user_entitlements, integration_registry
  TO app_rw;

-- Throttle rows are pruned, so DELETE is granted here alone.
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_throttle TO app_rw;

-- Append-only records. The runtime inserts and reads; no role may rewrite or
-- remove a row. The dedicated append role cannot even read.
GRANT SELECT, INSERT ON domain_event, phi_access_log TO app_rw;
GRANT INSERT ON domain_event, phi_access_log TO app_append;

-- The verifier reads every tenant's chain and nothing else.
GRANT SELECT ON domain_event TO app_verify;
CREATE POLICY domain_event_verify ON domain_event
  FOR SELECT TO app_verify USING (true);

-- Only the runtime may call the lookups. 0002 granted PUBLIC for local use.
-- This must run while the migrator still owns the functions: a REVOKE by a
-- non-owner is a silent no-op.
REVOKE EXECUTE ON FUNCTION auth_lookup_user(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION auth_lookup_user_by_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION auth_lookup_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user(text) TO app_rw;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_id(uuid) TO app_rw;
GRANT EXECUTE ON FUNCTION auth_lookup_session(uuid) TO app_rw;

-- FORCE ROW LEVEL SECURITY binds table owners too, so a SECURITY DEFINER
-- lookup owned by the migrator sees no rows. A superuser owner would pass in
-- CI and fail in production. Hand the functions to a role that owns nothing
-- else and let a role-scoped SELECT policy admit it.
ALTER FUNCTION auth_lookup_user(text) OWNER TO app_auth_lookup;
ALTER FUNCTION auth_lookup_user_by_id(uuid) OWNER TO app_auth_lookup;
ALTER FUNCTION auth_lookup_session(uuid) OWNER TO app_auth_lookup;

GRANT SELECT ON users, sessions TO app_auth_lookup;
CREATE POLICY users_auth_lookup ON users
  FOR SELECT TO app_auth_lookup USING (true);
CREATE POLICY sessions_auth_lookup ON sessions
  FOR SELECT TO app_auth_lookup USING (true);
