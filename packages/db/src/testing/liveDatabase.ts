import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { applyMigrations } from "../migrate";
import { ROLES_SQL_PATH } from "../cli";

/**
 * Throwaway database for live tests. Reads PMS_TEST_POSTGRES_URL (an
 * administrator connection), creates `pms_live_<random>`, runs sql/roles.sql,
 * then applies every migration as app_migrate — the same non-superuser path
 * production uses. Drop it with `destroy()`.
 */

export const LIVE_URL_ENV = "PMS_TEST_POSTGRES_URL";

export function liveAdminUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const url = env[LIVE_URL_ENV];
  if (!url && env.PMS_TEST_POSTGRES_REQUIRED === "1") {
    throw new Error(`${LIVE_URL_ENV} is required when PMS_TEST_POSTGRES_REQUIRED=1.`);
  }
  return url || undefined;
}

export interface LiveDatabase {
  name: string;
  /** Connection string for the throwaway database, as the administrator. */
  url: string;
  /** Administrator connection to the throwaway database. */
  admin: Client;
  /** Open one more administrator connection (e.g. for a pool under test). */
  connect(): Promise<Client>;
  /**
   * Connection string for a throwaway LOGIN role that inherits `role`
   * (app_rw, app_verify, ...). The cluster roles stay NOLOGIN.
   */
  loginAs(role: string): Promise<string>;
  destroy(): Promise<void>;
}

export async function createLiveDatabase(adminUrl: string): Promise<LiveDatabase> {
  const name = `pms_live_${randomBytes(6).toString("hex")}`;
  const control = new Client({ connectionString: adminUrl });
  await control.connect();
  await control.query(`CREATE DATABASE ${name}`);
  await control.end();

  const url = withDatabase(adminUrl, name);
  const admin = new Client({ connectionString: url });
  await admin.connect();
  await admin.query(readFileSync(ROLES_SQL_PATH, "utf8"));
  await admin.query("SET ROLE app_migrate");
  await applyMigrations(admin);
  await admin.query("RESET ROLE");

  const extras: Client[] = [];
  const loginRoles: string[] = [];
  return {
    name,
    url,
    admin,
    async connect() {
      const client = new Client({ connectionString: url });
      await client.connect();
      extras.push(client);
      return client;
    },
    async loginAs(role) {
      if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("role is not a plain role name.");
      const login = `${name}_${role}`;
      const password = randomBytes(12).toString("hex");
      await admin.query(
        `CREATE ROLE ${login} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT`
      );
      await admin.query(`GRANT ${role} TO ${login}`);
      loginRoles.push(login);
      const parsed = new URL(url);
      parsed.username = login;
      parsed.password = password;
      return parsed.toString();
    },
    async destroy() {
      for (const client of extras) await client.end().catch(() => {});
      await admin.end();
      const drop = new Client({ connectionString: adminUrl });
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      for (const login of loginRoles) await drop.query(`DROP ROLE IF EXISTS ${login}`);
      await drop.end();
    },
  };
}

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}
