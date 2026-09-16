import { sql } from "drizzle-orm";
import type { AppDb } from "../db/client";

/**
 * Transaction-scoped advisory locks, one per tenant and per subject, released
 * at COMMIT or ROLLBACK. withTenantTransaction runs READ COMMITTED, so an
 * evaluate-then-write sequence is only atomic against other writers when the
 * writer takes the subject's lock before it reads. Grants and policy versions
 * both need that: two concurrent grants could otherwise each pass the SoD
 * check against the same pre-state, and two policy writers could race for the
 * same next version.
 */
export const TENANT_GRANT_LOCK_SQL = (tenantId: string) =>
  sql`SELECT pg_advisory_xact_lock(hashtext('user_entitlements'), hashtext(${tenantId}))`;

export const TENANT_POLICY_LOCK_SQL = (tenantId: string) =>
  sql`SELECT pg_advisory_xact_lock(hashtext('control_policies'), hashtext(${tenantId}))`;

export async function lockTenantGrants(db: AppDb, tenantId: string): Promise<void> {
  await db.execute(TENANT_GRANT_LOCK_SQL(tenantId));
}

export async function lockTenantPolicy(db: AppDb, tenantId: string): Promise<void> {
  await db.execute(TENANT_POLICY_LOCK_SQL(tenantId));
}
