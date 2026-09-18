import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@pms/db/schema";
import { SET_LOCAL_TENANT_SQL } from "@pms/db";

let pool: Pool | undefined;
let appendPool: Pool | undefined;
let runtimeRoleProbe: Promise<void> | undefined;
let appendRoleProbe: Promise<void> | undefined;

export type AppDb = NodePgDatabase<typeof schema>;

/** Refuses a superuser or table-owning connection on the first pool use in production. */
export async function ensureProductionRuntimeRole(
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  if (env.NODE_ENV !== "production" || env.AUTH_DEV_MEMORY === "1") return;
  runtimeRoleProbe ??= (async () => {
    const { assertRuntimeRole } = await import("../boot/runtimeRole");
    const facts = await assertRuntimeRole(getPool(env));
    console.log(`[boot] database role ${facts.role}: not superuser, not BYPASSRLS, owns no tables`);
  })();
  await runtimeRoleProbe;
}

/**
 * A pool whose idle-client failures are handled rather than fatal.
 *
 * `pg` emits `error` on the pool when a client sitting idle in it fails: the
 * database restarted, a failover moved it, an administrator terminated the
 * backend. In Node an `error` event with no listener is an uncaught exception,
 * so an untended pool turns a routine connection drop into a crashed server —
 * and, in the test harness, into a run that fails after every test passed,
 * which is how this was found. The pool has already discarded that client by
 * the time this runs; the next caller is handed a fresh one.
 */
function handleIdleErrors(created: Pool, role: string): Pool {
  created.on("error", (err: unknown) => {
    console.error(`[db] ${role} pool discarded an idle connection: ${err instanceof Error ? err.message : String(err)}`);
  });
  return created;
}

export function getPool(env: Record<string, string | undefined> = process.env): Pool {
  const url = env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not set.");
  pool ??= handleIdleErrors(new Pool({ connectionString: url }), "runtime");
  void ensureProductionRuntimeRole(env);
  return pool;
}

/** Append-only ledger writes use a separate role when APPEND_ROLE_DSN is set. */
export async function ensureProductionAppendRole(
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  if (env.NODE_ENV !== "production" || env.AUTH_DEV_MEMORY === "1") return;
  appendRoleProbe ??= (async () => {
    const { assertAppendRole } = await import("../boot/appendRole");
    const facts = await assertAppendRole(getAppendPool(env));
    console.log(`[boot] append role ${facts.role}: holds app_append, cannot rewrite domain_event`);
  })();
  await appendRoleProbe;
}

export function getAppendPool(env: Record<string, string | undefined> = process.env): Pool {
  const url = env.APPEND_ROLE_DSN ?? env.POSTGRES_URL;
  if (!url) throw new Error("APPEND_ROLE_DSN or POSTGRES_URL is required for ledger appends.");
  appendPool ??= handleIdleErrors(new Pool({ connectionString: url }), "append");
  void ensureProductionAppendRole(env);
  return appendPool;
}

export function getDb(env: Record<string, string | undefined> = process.env): AppDb {
  return drizzle(getPool(env), { schema });
}

export async function withTenantTransaction<T>(
  tenantId: string,
  userId: string,
  fn: (db: AppDb) => Promise<T>,
  env: Record<string, string | undefined> = process.env
): Promise<T> {
  await ensureProductionRuntimeRole(env);
  const client = await getPool(env).connect();
  try {
    await client.query("BEGIN");
    await client.query(SET_LOCAL_TENANT_SQL, [tenantId, userId]);
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withTenantAppendTransaction<T>(
  tenantId: string,
  userId: string,
  fn: (db: AppDb) => Promise<T>,
  env: Record<string, string | undefined> = process.env
): Promise<T> {
  await ensureProductionAppendRole(env);
  const client = await getAppendPool(env).connect();
  try {
    await client.query("BEGIN");
    await client.query(SET_LOCAL_TENANT_SQL, [tenantId, userId]);
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function resetDbPoolForTests(): Promise<void> {
  const current = pool;
  const currentAppend = appendPool;
  pool = undefined;
  appendPool = undefined;
  runtimeRoleProbe = undefined;
  appendRoleProbe = undefined;
  await current?.end();
  await currentAppend?.end();
}
