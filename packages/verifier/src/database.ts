import { verifyChain, type ChainEvent, type ChainVerdict } from "./chain";

/**
 * Reads every tenant's event chain from a live database and verifies each.
 * The connection should be app_verify: SELECT on domain_event and nothing
 * else, admitted across tenants by the domain_event_verify policy.
 *
 * Restated here, not imported: the column list and the ordering rule.
 * Chain order is the per-tenant seq, not occurred_at — two events in one
 * millisecond have no time order.
 */

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export const CHAIN_QUERY = `
SELECT tenant_id, kind, payload, prev_hash, hash, occurred_at, seq
  FROM domain_event
 ORDER BY tenant_id, seq`;

export interface TenantChainVerdict extends ChainVerdict {
  tenantId: string;
  events: number;
}

export interface DatabaseVerdict {
  publish: boolean;
  tenants: TenantChainVerdict[];
  events: number;
  checkedAt: string;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

export function groupByTenant(rows: Record<string, unknown>[]): Map<string, ChainEvent[]> {
  const chains = new Map<string, ChainEvent[]>();
  for (const row of rows) {
    const tenantId = String(row.tenant_id);
    const list = chains.get(tenantId) ?? [];
    list.push({
      tenantId,
      kind: String(row.kind),
      payload: row.payload,
      prevHash: String(row.prev_hash),
      hash: String(row.hash),
      occurredAt: toIso(row.occurred_at),
      seq: Number(row.seq),
    });
    chains.set(tenantId, list);
  }
  return chains;
}

export async function verifyDatabaseChains(db: Queryable): Promise<DatabaseVerdict> {
  const { rows } = await db.query(CHAIN_QUERY);
  const tenants: TenantChainVerdict[] = [];
  for (const [tenantId, events] of groupByTenant(rows)) {
    tenants.push({ tenantId, events: events.length, ...verifyChain(events) });
  }
  return {
    publish: tenants.every((t) => t.publish),
    tenants,
    events: rows.length,
    checkedAt: new Date().toISOString(),
  };
}
