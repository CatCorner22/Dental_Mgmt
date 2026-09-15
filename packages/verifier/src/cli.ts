import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { verifyDatabaseChains } from "./database";

/**
 * pnpm --filter @pms/verifier verify:chain
 *
 * Connection: VERIFY_ROLE_DSN, else POSTGRES_URL. PMS_VERIFY_ROLE, when set,
 * is SET ROLE'd first so a shared local superuser still reads as app_verify.
 * Prints one JSON verdict and exits 1 when any tenant's chain refuses.
 * Meant for a nightly job; it writes nothing.
 */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const url = env.VERIFY_ROLE_DSN ?? env.POSTGRES_URL;
  if (!url) {
    console.error("Set VERIFY_ROLE_DSN or POSTGRES_URL.");
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
