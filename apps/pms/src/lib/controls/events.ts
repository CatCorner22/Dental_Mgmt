import { eq, sql } from "drizzle-orm";
import { domainEvent, GENESIS_HASH, hashDomainEvent, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { TENANT_CHAIN_LOCK_SQL } from "../auth/postgresStore";

/**
 * The chain hasher (packages/db/src/chain.ts) canonicalizes a payload with
 * JSON.stringify and a sorted key whitelist. That binds every top-level key
 * and every array of primitives, but the keys of a nested object are
 * filtered against the top-level list and can vanish from the hash. A
 * control payload therefore stays flat: primitives, or arrays of primitives.
 */
export function assertFlatPayload(payload: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.some((v) => v !== null && typeof v === "object")) {
        throw new Error(`Control event payload "${key}" holds nested objects; the chain hash would not bind them.`);
      }
      continue;
    }
    if (typeof value === "object") {
      throw new Error(`Control event payload "${key}" is a nested object; the chain hash would not bind it.`);
    }
  }
}

/**
 * Appends one hash-chained domain_event row inside the caller's tenant
 * transaction. Takes the per-tenant advisory lock first so concurrent
 * appends serialize; the unique (tenant_id, seq) index is the backstop.
 */
export async function appendControlEvent(
  db: AppDb,
  tenantId: string,
  actorUserId: string,
  kind: string,
  payload: Record<string, unknown>,
  at: Date
): Promise<void> {
  assertFlatPayload(payload);
  await db.execute(TENANT_CHAIN_LOCK_SQL(tenantId));
  const [last] = await db
    .select({ hash: domainEvent.hash, seq: domainEvent.seq })
    .from(domainEvent)
    .where(eq(domainEvent.tenantId, tenantId))
    .orderBy(sql`${domainEvent.seq} desc`)
    .limit(1);
  const prevHash = last?.hash ?? GENESIS_HASH;
  const seq = (last?.seq ?? 0) + 1;
  const hash = hashDomainEvent({
    prevHash,
    tenantId,
    actorUserId,
    kind,
    payload,
    occurredAt: at.toISOString(),
  });
  await db.insert(domainEvent).values({
    id: uuidv7(at.getTime()),
    tenantId,
    actorUserId,
    kind,
    payload,
    prevHash,
    hash,
    occurredAt: at,
    seq,
  });
}
