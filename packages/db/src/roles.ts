/**
 * Postgres roles. Created once per database by sql/roles.sql; granted by
 * migrations from 0003. The application connects as app_rw, never as an
 * owner or superuser, so FORCE ROW LEVEL SECURITY holds.
 */
export const DB_ROLES = {
  app_rw: {
    name: "app_rw",
    purpose:
      "Application runtime. SELECT/INSERT/UPDATE on mutable tables; never BYPASSRLS; never owner.",
  },
  app_append: {
    name: "app_append",
    purpose:
      "INSERT-only on ledger entries, allocations, approvals, control decisions, claim events, chart events, filed notes, domain events, and the PHI access log.",
  },
  app_migrate: {
    name: "app_migrate",
    purpose: "Applies migrations and owns every table. Not used by the application process.",
  },
  app_auth_lookup: {
    name: "app_auth_lookup",
    purpose:
      "Owns the SECURITY DEFINER auth lookups and nothing else. A role-scoped SELECT policy on users and sessions admits it before a tenant is bound.",
  },
  app_verify: {
    name: "app_verify",
    purpose: "Nightly chain verifier. SELECT on domain_event across tenants; no other table.",
  },
} as const;

/** Roles a running process may connect as. */
export const PROCESS_ROLES = ["app_rw", "app_append", "app_migrate"] as const;

export type DbRoleName = keyof typeof DB_ROLES;
