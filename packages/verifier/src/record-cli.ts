import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { fileObjectLockSink } from "./anchor";
import { recordDatabaseChains } from "./record";

/**
 * pnpm --filter @pms/verifier verify:chain:record
 *
 * Verify: VERIFY_ROLE_DSN, or PMS_VERIFY_ROLE with POSTGRES_URL.
 * Record: APPEND_ROLE_DSN, or PMS_APPEND_ROLE with POSTGRES_URL.
 * DAY: UTC calendar day to stamp (defaults to today).
 * Anchor: OBJECT_STORAGE_URL (file:// for dev/CI) and CHAIN_HEAD_SIGN_KEY.
 */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const verifyUrl = env.VERIFY_ROLE_DSN ?? (env.PMS_VERIFY_ROLE ? env.POSTGRES_URL : undefined);
  const appendUrl = env.APPEND_ROLE_DSN ?? (env.PMS_APPEND_ROLE ? env.POSTGRES_URL : undefined);
  if (!verifyUrl) {
    console.error("Set VERIFY_ROLE_DSN (an app_verify login), or PMS_VERIFY_ROLE together with POSTGRES_URL.");
    return 2;
  }
  if (!appendUrl) {
    console.error("Set APPEND_ROLE_DSN (an app_append login), or PMS_APPEND_ROLE together with POSTGRES_URL.");
    return 2;
  }

  const day = env.DAY ?? new Date().toISOString().slice(0, 10);
  const verifyClient = new Client({ connectionString: verifyUrl });
  const appendClient = new Client({ connectionString: appendUrl });
  await verifyClient.connect();
  await appendClient.connect();
  try {
    const verifyRole = env.PMS_VERIFY_ROLE;
    if (verifyRole) {
      if (!/^[a-z_][a-z0-9_]*$/.test(verifyRole)) throw new Error("PMS_VERIFY_ROLE is not a plain role name.");
      await verifyClient.query(`SET ROLE ${verifyRole}`);
    }
    const appendRole = env.PMS_APPEND_ROLE;
    if (appendRole) {
      if (!/^[a-z_][a-z0-9_]*$/.test(appendRole)) throw new Error("PMS_APPEND_ROLE is not a plain role name.");
      await appendClient.query(`SET ROLE ${appendRole}`);
    }
    const storageUrl = env.OBJECT_STORAGE_URL;
    const signKey = env.CHAIN_HEAD_SIGN_KEY;
    const anchor =
      storageUrl && signKey ? { sink: fileObjectLockSink(storageUrl), signKey } : undefined;
    const verdict = await recordDatabaseChains(verifyClient, appendClient, day, { anchor });
    console.log(JSON.stringify(verdict, null, 2));
    const ok = verdict.publish && verdict.objections.length === 0;
    return ok ? 0 : 1;
  } finally {
    await verifyClient.end();
    await appendClient.end();
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
