/**
 * Restated promises. This package must not import the application or @pms/db
 * schema — if it did, a bug on both sides would cancel itself out.
 *
 * Double-entry: the migration writes tables and policies; this file names the
 * same tables and the evidence a later reader must find in SQL and in the
 * event chain.
 */

export interface PipelineStep {
  id: string;
  promise: string;
  evidence: string;
  ifAbsent: string;
}

export const CHAIN_STEPS: readonly PipelineStep[] = [
  {
    id: "verifier-admitted",
    promise: "The verifying connection holds app_verify, so row-level security shows it every tenant.",
    evidence: "pg_has_role(current_user, 'app_verify', 'USAGE') is true before any chain is read.",
    ifAbsent: "An ordinary role sees zero rows under RLS and an empty result would pass as a clean chain.",
  },
  {
    id: "genesis-known",
    promise: "The first event in a tenant chain follows a published genesis hash.",
    evidence: "prev_hash on the first row is 64 ASCII zeros.",
    ifAbsent: "The chain has no agreed start, so later hashes cannot be checked.",
  },
  {
    id: "hash-agrees",
    promise: "Each event hash is SHA-256 of prev_hash, tenant, kind, payload, and time.",
    evidence: "Recomputing the digest from those fields matches the stored hash.",
    ifAbsent: "A row was rewritten or assembled from two different events.",
  },
  {
    id: "links-hold",
    promise: "Each event after the first names the previous event's hash as prev_hash.",
    evidence: "event[n].prev_hash === event[n-1].hash, in seq order.",
    ifAbsent: "A link was inserted, deleted, or reordered after the fact.",
  },
  {
    id: "sequence-dense",
    promise: "A tenant's events are numbered 1, 2, 3 … with no gap, when a seq is present.",
    evidence: "event[n].seq === n + 1 for every row read in seq order.",
    ifAbsent: "A row was removed from the middle or the chain was rebuilt from two sources.",
  },
];

export const RLS_STEPS: readonly PipelineStep[] = [
  {
    id: "rls-enabled",
    promise: "Every named table has row-level security enabled and forced.",
    evidence: "ALTER TABLE <name> ENABLE/FORCE ROW LEVEL SECURITY appears in the migration.",
    ifAbsent: "A table owner connection could read every tenant.",
  },
  {
    id: "tenant-predicate",
    promise: "Tenant-scoped tables filter on current_setting('app.tenant_id').",
    evidence: "A POLICY USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid).",
    ifAbsent: "A query missing WHERE tenant_id would leak rows across tenants.",
  },
  {
    id: "missing-where-cannot-leak",
    promise: "A deliberately missing WHERE clause cannot return another tenant's rows.",
    evidence:
      "FORCE ROW LEVEL SECURITY plus the tenant predicate; the negative probe asserts leak without RLS and isolation with it.",
    ifAbsent: "Application filters are the only isolation, and they fail open.",
  },
];

export const NAMED_TABLES = [
  "tenants",
  "locations",
  "users",
  "sessions",
  "user_entitlements",
  "domain_event",
  "phi_access_log",
  "integration_registry",
] as const;

export const LIMITS = [
  "The verifier reads SQL text and, as app_verify, the domain_event table alone. It writes nothing.",
  "It cannot prove the application's live role is non-owner. That is an operations check.",
  "It does not judge clinical or financial correctness.",
] as const;
