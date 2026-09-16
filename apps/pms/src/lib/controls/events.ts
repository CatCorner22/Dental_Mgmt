import { eq, sql } from "drizzle-orm";
import { domainEvent, GENESIS_HASH, hashDomainEvent, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { TENANT_CHAIN_LOCK_SQL } from "../auth/postgresStore";

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
