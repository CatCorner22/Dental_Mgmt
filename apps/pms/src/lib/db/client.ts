import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@pms/db/schema";
import { SET_LOCAL_TENANT_SQL } from "@pms/db";

let pool: Pool | undefined;
let runtimeRoleProbe: Promise<void> | undefined;

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

export function getPool(env: Record<string, string | undefined> = process.env): Pool {
  const url = env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not set.");
  pool ??= new Pool({ connectionString: url });
  void ensureProductionRuntimeRole(env);
  return pool;
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

export async function resetDbPoolForTests(): Promise<void> {
  const current = pool;
  pool = undefined;
  await current?.end();
}
