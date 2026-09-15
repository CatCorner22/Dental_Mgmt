import { verifyChain, type ChainEvent, type ChainVerdict, type Objection } from "./chain";
import { CHAIN_STEPS } from "./contract";

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

/**
 * Under FORCE RLS an ordinary role sees zero rows and an empty result would
 * pass as a clean chain. Refuse to read unless the connection holds
 * app_verify (directly, by inheritance, or as a superuser).
 */
export const VERIFIER_ROLE = "app_verify";
export const ADMITTED_QUERY = `SELECT current_user AS role, pg_has_role(current_user, '${VERIFIER_ROLE}', 'USAGE') AS admitted`;

export interface TenantChainVerdict extends ChainVerdict {
  tenantId: string;
  events: number;
  headHash: string;
}

const GENESIS_HASH = "0".repeat(64);

export interface DatabaseVerdict {
  publish: boolean;
  role: string | null;
  objections: Objection[];
  tenants: TenantChainVerdict[];
  events: number;
  checkedAt: string;
}

async function checkAdmitted(db: Queryable): Promise<{ role: string | null; objections: Objection[] }> {
  const step = CHAIN_STEPS.find((s) => s.id === "verifier-admitted")!;
  try {
    const { rows } = await db.query(ADMITTED_QUERY);
    const role = rows[0] ? String(rows[0].role) : null;
    if (rows[0]?.admitted === true) return { role, objections: [] };
    return {
      role,
      objections: [
        {
          stepId: step.id,
          severity: "refuse",
          says: `Connection role ${role ?? "unknown"} does not hold ${VERIFIER_ROLE}.`,
          because: step.ifAbsent,
        },
      ],
    };
  } catch (error) {
    return {
      role: null,
      objections: [
        {
          stepId: step.id,
          severity: "refuse",
          says: `Could not establish the connection's role: ${error instanceof Error ? error.message : String(error)}`,
          because: step.ifAbsent,
        },
      ],
    };
  }
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
  const checkedAt = new Date().toISOString();
  const admitted = await checkAdmitted(db);
  if (admitted.objections.length) {
    return { publish: false, role: admitted.role, objections: admitted.objections, tenants: [], events: 0, checkedAt };
  }
  const { rows } = await db.query(CHAIN_QUERY);
  const tenants: TenantChainVerdict[] = [];
  for (const [tenantId, events] of groupByTenant(rows)) {
    tenants.push({
      tenantId,
      events: events.length,
      headHash: events.length ? events[events.length - 1].hash : GENESIS_HASH,
      ...verifyChain(events),
    });
  }
  return {
    publish: tenants.every((t) => t.publish),
    role: admitted.role,
    objections: [],
    tenants,
    events: rows.length,
    checkedAt,
  };
}
