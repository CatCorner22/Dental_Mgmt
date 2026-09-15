/**
 * Transaction-local tenant binding for RLS.
 * `set_config(..., true)` is SET LOCAL — it dies at COMMIT/ROLLBACK.
 */
export const SET_LOCAL_TENANT_SQL =
  "SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)";

export function setLocalTenantParams(tenantId: string, userId: string): [string, string] {
  return [tenantId, userId];
}
