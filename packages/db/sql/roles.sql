-- Cluster roles for the PMS. Run once per database as an administrator:
--
--   psql "$ADMIN_URL" -f packages/db/sql/roles.sql
--
-- Idempotent. CREATE ROLE is cluster-wide and needs CREATEROLE, so it lives
-- here rather than in a migration. Table grants live in migrations (0003
-- onward). LOGIN and passwords are set by operations and never committed:
--
--   ALTER ROLE app_rw LOGIN PASSWORD '...';
--
-- app_migrate   applies migrations; owns every table. Not used by the app.
-- app_rw        application runtime. Never BYPASSRLS; never a table owner.
-- app_append    INSERT-only on domain_event, phi_access_log, later ledgers.
-- app_auth_lookup owns the SECURITY DEFINER auth lookups and nothing else.
-- app_verify    nightly chain verifier; SELECT on domain_event across tenants.

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['app_migrate', 'app_rw', 'app_append', 'app_auth_lookup', 'app_verify']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT', r);
    END IF;
  END LOOP;
END
$$;

-- The migrator must be able to hand the lookup functions to their owner role.
-- INHERIT FALSE matters: policies granted TO a role apply to every member
-- that inherits it, so a plain GRANT would let app_migrate read every tenant
-- through the users_auth_lookup policy. (PostgreSQL 16 syntax.)
GRANT app_auth_lookup TO app_migrate WITH INHERIT FALSE, SET TRUE;

-- PostgreSQL 15+ no longer lets every role create in public.
GRANT USAGE, CREATE ON SCHEMA public TO app_migrate;
GRANT USAGE ON SCHEMA public TO app_rw, app_append, app_verify;
-- ALTER FUNCTION ... OWNER TO requires the new owner to hold CREATE on the
-- schema. The role has NOLOGIN, so nothing can exercise that privilege.
GRANT USAGE, CREATE ON SCHEMA public TO app_auth_lookup;
