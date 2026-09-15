import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@pms/db/schema";
import { SET_LOCAL_TENANT_SQL } from "@pms/db";

let pool: Pool | undefined;

export type AppDb = NodePgDatabase<typeof schema>;

export function getPool(env: Record<string, string | undefined> = process.env): Pool {
  const url = env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not set.");
  pool ??= new Pool({ connectionString: url });
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

export function resetDbPoolForTests(): void {
  pool = undefined;
}
