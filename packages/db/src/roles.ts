/**
 * Three Postgres roles. Local compose uses a single superuser until a vault
 * exists. Production must connect as a non-owner so RLS cannot be bypassed.
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
    purpose: "Applies drizzle-kit migrations. Not used by the application process.",
  },
} as const;

export type DbRoleName = keyof typeof DB_ROLES;
