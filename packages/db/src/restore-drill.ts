import { accessSync, constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { uuidv7 } from "./ids";
import { GENESIS_HASH, hashDomainEvent } from "./chain";
import { SET_LOCAL_TENANT_SQL } from "./tenant-context";

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface RestoreDrillTenantResult {
  tenantId: string;
  eventId: string;
}

export interface RestoreDrillVerdict {
  ok: boolean;
  backupTarget: string;
  tenants: RestoreDrillTenantResult[];
  checkedAt: string;
  reason?: string;
}

/** Phase 0 checks reachability for file:// targets; cloud URLs are format-validated only. */
export function checkBackupTarget(target: string): { ok: true } | { ok: false; reason: string } {
  try {
    const url = new URL(target);
    if (url.protocol === "file:") {
      accessSync(fileURLToPath(url), constants.R_OK);
      return { ok: true };
    }
    if (url.protocol === "s3:") return { ok: true };
    return { ok: false, reason: `Unsupported backup protocol: ${url.protocol}` };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function appendRestoreDrillEvent(
  appendDb: Queryable,
  tenantId: string,
  backupTarget: string,
  at: Date
): Promise<string> {
  await appendDb.query("BEGIN");
  try {
    await appendDb.query(SET_LOCAL_TENANT_SQL, [tenantId, tenantId]);
    await appendDb.query(
      "SELECT pg_advisory_xact_lock(hashtext('domain_event'), hashtext($1::text))",
      [tenantId]
    );
    const { rows } = await appendDb.query(
      `SELECT hash, seq FROM domain_event WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1`,
      [tenantId]
    );
    const prevHash = (rows[0]?.hash as string | undefined) ?? GENESIS_HASH;
    const seq = Number(rows[0]?.seq ?? 0) + 1;
    const occurredAt = at;
    const payload = { backupTarget, ok: true };
    const hash = hashDomainEvent({
      prevHash,
      tenantId,
      kind: "backup.restore_drill",
      payload,
      occurredAt: occurredAt.toISOString(),
    });
    const id = uuidv7(at.getTime());
    await appendDb.query(
      `INSERT INTO domain_event (id, tenant_id, actor_user_id, kind, payload, prev_hash, hash, occurred_at, seq)
       VALUES ($1, $2, NULL, $3, $4::jsonb, $5, $6, $7, $8)`,
      [id, tenantId, "backup.restore_drill", JSON.stringify(payload), prevHash, hash, occurredAt, seq]
    );
    await appendDb.query("COMMIT");
    return id;
  } catch (error) {
    await appendDb.query("ROLLBACK");
    throw error;
  }
}

/**
 * Verifies BACKUP_TARGET is reachable and appends `backup.restore_drill` for
 * every tenant through the append-only role.
 */
export async function runRestoreDrill(
  adminDb: Queryable,
  appendDb: Queryable,
  backupTarget: string,
  at: Date = new Date()
): Promise<RestoreDrillVerdict> {
  const checkedAt = at.toISOString();
  const target = checkBackupTarget(backupTarget);
  if (!target.ok) {
    return { ok: false, backupTarget, tenants: [], checkedAt, reason: target.reason };
  }

  const { rows } = await adminDb.query("SELECT id FROM tenants ORDER BY id");
  const tenants: RestoreDrillTenantResult[] = [];
  for (const row of rows) {
    const tenantId = String(row.id);
    const eventId = await appendRestoreDrillEvent(appendDb, tenantId, backupTarget, at);
    tenants.push({ tenantId, eventId });
  }
  return { ok: true, backupTarget, tenants, checkedAt };
}
