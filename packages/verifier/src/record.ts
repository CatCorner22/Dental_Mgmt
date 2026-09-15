import { anchorRecordedHeads, type ObjectLockSink } from "./anchor";
import { verifyDatabaseChains, type DatabaseVerdict, type Queryable } from "./database";

export const APPEND_ROLE = "app_append";
export const APPEND_ADMITTED_QUERY = `SELECT current_user AS role, pg_has_role(current_user, '${APPEND_ROLE}', 'USAGE') AS admitted`;
export const SET_LOCAL_TENANT_SQL =
  "SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)";

export interface RecordedTenant {
  tenantId: string;
  day: string;
  ok: boolean;
  headHash: string;
  eventCount: number;
  inserted: boolean;
  objectLockKey: string | null;
  anchored: boolean;
}

export interface RecordOptions {
  anchor?: {
    sink: ObjectLockSink;
    signKey: string;
  };
}

export interface RecordVerdict extends DatabaseVerdict {
  day: string;
  recorded: RecordedTenant[];
  anchored: number;
}

async function checkAppendAdmitted(db: Queryable): Promise<{ role: string | null; objections: DatabaseVerdict["objections"] }> {
  try {
    const { rows } = await db.query(APPEND_ADMITTED_QUERY);
    const role = rows[0] ? String(rows[0].role) : null;
    if (rows[0]?.admitted === true) return { role, objections: [] };
    return {
      role,
      objections: [
        {
          stepId: "append-admitted",
          severity: "refuse",
          says: `Connection role ${role ?? "unknown"} does not hold ${APPEND_ROLE}.`,
          because: "Nightly chain recording must write as the append-only role.",
        },
      ],
    };
  } catch (error) {
    return {
      role: null,
      objections: [
        {
          stepId: "append-admitted",
          severity: "refuse",
          says: `Could not establish the append connection's role: ${error instanceof Error ? error.message : String(error)}`,
          because: "Nightly chain recording must write as the append-only role.",
        },
      ],
    };
  }
}

/**
 * Verifies every tenant chain as app_verify, then writes one row per tenant
 * per UTC day into audit_chain_checks as app_append. Idempotent: a row that
 * already exists for (tenant_id, day) is left unchanged.
 */
export async function recordDatabaseChains(
  verifyDb: Queryable,
  appendDb: Queryable,
  day: string,
  options: RecordOptions = {}
): Promise<RecordVerdict> {
  const checkedAt = new Date().toISOString();
  const verdict = await verifyDatabaseChains(verifyDb);
  if (verdict.objections.length) {
    return { ...verdict, day, recorded: [], anchored: 0 };
  }

  const admitted = await checkAppendAdmitted(appendDb);
  if (admitted.objections.length) {
    return { ...verdict, objections: admitted.objections, recorded: [], day, anchored: 0 };
  }

  const recorded: RecordedTenant[] = [];
  for (const tenant of verdict.tenants) {
    await appendDb.query("BEGIN");
    try {
      await appendDb.query(SET_LOCAL_TENANT_SQL, [tenant.tenantId, tenant.tenantId]);
      const insert = await appendDb.query(
        `INSERT INTO audit_chain_checks (tenant_id, day, ok, head_hash, event_count, checked_at)
         VALUES ($1, $2::date, $3, $4, $5, $6::timestamptz)
         ON CONFLICT (tenant_id, day) DO NOTHING
         RETURNING tenant_id`,
        [tenant.tenantId, day, tenant.publish, tenant.headHash, tenant.events, checkedAt]
      );
      await appendDb.query("COMMIT");
      recorded.push({
        tenantId: tenant.tenantId,
        day,
        ok: tenant.publish,
        headHash: tenant.headHash,
        eventCount: tenant.events,
        inserted: insert.rows.length > 0,
        objectLockKey: null,
        anchored: false,
      });
    } catch (error) {
      await appendDb.query("ROLLBACK");
      throw error;
    }
  }

  let anchoredRows = recorded;
  if (options.anchor) {
    const anchored = await anchorRecordedHeads(recorded, checkedAt, options.anchor.sink, options.anchor.signKey);
    for (const row of anchored) {
      if (!row.anchored || !row.objectLockKey) continue;
      await appendDb.query("BEGIN");
      try {
        await appendDb.query(SET_LOCAL_TENANT_SQL, [row.tenantId, row.tenantId]);
        await appendDb.query(
          `UPDATE audit_chain_checks
              SET object_lock_key = $3
            WHERE tenant_id = $1 AND day = $2::date AND object_lock_key IS NULL`,
          [row.tenantId, row.day, row.objectLockKey]
        );
        await appendDb.query("COMMIT");
      } catch (error) {
        await appendDb.query("ROLLBACK");
        throw error;
      }
    }
    anchoredRows = anchored;
  }

  return {
    ...verdict,
    day,
    recorded: anchoredRows,
    anchored: anchoredRows.filter((row) => row.anchored).length,
  };
}
