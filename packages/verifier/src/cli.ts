import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { verifyDatabaseChains } from "./database";

/**
 * pnpm --filter @pms/verifier verify:chain
 *
 * Connection: VERIFY_ROLE_DSN. PMS_VERIFY_ROLE, when set, is SET ROLE'd
 * first so a shared local superuser still reads as app_verify; only then is
 * POSTGRES_URL accepted as the connection. The application's own DSN is
 * never used silently: an app_rw connection sees zero rows under RLS, and
 * verifyDatabaseChains refuses a connection that does not hold app_verify.
 * Prints one JSON verdict and exits 1 on any refusal. Writes nothing.
 */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const url = env.VERIFY_ROLE_DSN ?? (env.PMS_VERIFY_ROLE ? env.POSTGRES_URL : undefined);
  if (!url) {
    console.error("Set VERIFY_ROLE_DSN (an app_verify login), or PMS_VERIFY_ROLE together with POSTGRES_URL.");
    return 2;
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const role = env.PMS_VERIFY_ROLE;
    if (role) {
      if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("PMS_VERIFY_ROLE is not a plain role name.");
      await client.query(`SET ROLE ${role}`);
    }
    const verdict = await verifyDatabaseChains(client);
    console.log(JSON.stringify(verdict, null, 2));
    return verdict.publish ? 0 : 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  );
}
