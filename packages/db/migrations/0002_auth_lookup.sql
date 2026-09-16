-- Increment 0.2: login can resolve a user before withGuard has a tenant.
-- FORCE RLS would otherwise hide every users row during authorize().
-- The lookup is SECURITY DEFINER and returns one row by globally unique username.

CREATE UNIQUE INDEX users_username_lower_uidx ON users (lower(username));

CREATE OR REPLACE FUNCTION auth_lookup_user(p_username text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  username text,
  display_name text,
  password_hash text,
  role text,
  clinical_role text,
  active boolean,
  mfa_secret_enc jsonb,
  mfa_enrolled_at timestamptz,
  recovery_codes_hash text,
  password_changed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.tenant_id,
    u.username,
    u.display_name,
    u.password_hash,
    u.role,
    u.clinical_role,
    u.active,
    u.mfa_secret_enc,
    u.mfa_enrolled_at,
    u.recovery_codes_hash,
    u.password_changed_at
  FROM users u
  WHERE lower(u.username) = lower(p_username)
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION auth_lookup_user_by_id(p_id uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  username text,
  display_name text,
  password_hash text,
  role text,
  clinical_role text,
  active boolean,
  mfa_secret_enc jsonb,
  mfa_enrolled_at timestamptz,
  recovery_codes_hash text,
  password_changed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.tenant_id,
    u.username,
    u.display_name,
    u.password_hash,
    u.role,
    u.clinical_role,
    u.active,
    u.mfa_secret_enc,
    u.mfa_enrolled_at,
    u.recovery_codes_hash,
    u.password_changed_at
  FROM users u
  WHERE u.id = p_id
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION auth_lookup_session(p_id uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  revoked_at timestamptz,
  idle_expires_at timestamptz,
  absolute_expires_at timestamptz,
  last_seen_at timestamptz,
  device_profile text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.tenant_id,
    s.user_id,
    s.revoked_at,
    s.idle_expires_at,
    s.absolute_expires_at,
    s.last_seen_at,
    s.device_profile
  FROM sessions s
  WHERE s.id = p_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_lookup_user_by_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_lookup_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_id(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_session(uuid) TO PUBLIC;
