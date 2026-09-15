import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { applyMigrations, migrationStatus } from "./migrate";

/**
 * pnpm --filter @pms/db db:<command>
 *
 *   roles    apply sql/roles.sql (idempotent; needs CREATEROLE)
 *   migrate  apply pending migrations
 *   status   list each migration as applied / pending / drift
 *   reset    drop schema public, re-run roles and migrations
 *            (refuses unless PMS_ALLOW_DB_RESET=1)
 *
 * Connection: PMS_MIGRATE_URL, else POSTGRES_URL.
 * PMS_MIGRATE_ROLE, when set, is SET ROLE'd before migrating so CI applies
 * migrations as app_migrate exactly as production does.
 */

export const ROLES_SQL_PATH = join(dirname(fileURLToPath(import.meta.url)), "../sql/roles.sql");

function connectionString(env: NodeJS.ProcessEnv): string {
  const url = env.PMS_MIGRATE_URL ?? env.POSTGRES_URL;
  if (!url) throw new Error("Set PMS_MIGRATE_URL or POSTGRES_URL.");
  return url;
}

async function withClient<T>(
  env: NodeJS.ProcessEnv,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({ connectionString: connectionString(env) });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function runRolesSql(client: Client): Promise<void> {
  await client.query(readFileSync(ROLES_SQL_PATH, "utf8"));
}

async function assumeMigrateRole(client: Client, env: NodeJS.ProcessEnv): Promise<void> {
  const role = env.PMS_MIGRATE_ROLE;
  if (!role) return;
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("PMS_MIGRATE_ROLE is not a plain role name.");
  await client.query(`SET ROLE ${role}`);
}

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const command = argv[0];
  const log = (line: string) => console.log(line);

  switch (command) {
    case "roles":
      await withClient(env, runRolesSql);
      log("roles: ok");
      return 0;

    case "migrate":
      await withClient(env, async (client) => {
        await assumeMigrateRole(client, env);
        const result = await applyMigrations(client, { log });
        log(`migrate: ${result.applied.length} applied, ${result.alreadyApplied} already present`);
      });
      return 0;

    case "status": {
      let drift = false;
      await withClient(env, async (client) => {
        for (const row of await migrationStatus(client)) {
          const when = row.appliedAt ? ` ${row.appliedAt.toISOString()}` : "";
          log(`${row.state.padEnd(8)} ${row.file}${when}`);
          if (row.state === "drift") drift = true;
        }
      });
      return drift ? 1 : 0;
    }

    case "reset":
      if (env.PMS_ALLOW_DB_RESET !== "1") {
        console.error("reset drops every table. Set PMS_ALLOW_DB_RESET=1 to confirm.");
        return 2;
      }
      await withClient(env, async (client) => {
        await client.query("DROP SCHEMA public CASCADE");
        await client.query("CREATE SCHEMA public");
        await runRolesSql(client);
        await assumeMigrateRole(client, env);
        const result = await applyMigrations(client, { log });
        log(`reset: ${result.applied.length} migrations applied`);
      });
      return 0;

    default:
      console.error("usage: db <roles|migrate|status|reset>");
      return 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  );
}
