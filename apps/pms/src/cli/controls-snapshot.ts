import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { resetDbPoolForTests } from "../lib/db/client";
import { snapshotAllTenants } from "../lib/controls/nightly";

/**
 * pnpm --filter @pms/app controls:snapshot
 *
 * Freezes one control snapshot per tenant and refreshes sod_findings.
 *   PMS_ADMIN_URL (else PMS_MIGRATE_URL, else POSTGRES_URL): lists tenants.
 *   POSTGRES_URL: the runtime connection the scoring runs on, tenant-bound.
 * In production POSTGRES_URL is an app_rw login, as for the app itself.
 * Exits 1 when any tenant failed, 2 when the connection is not configured.
 */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const adminUrl = env.PMS_ADMIN_URL ?? env.PMS_MIGRATE_URL ?? env.POSTGRES_URL;
  if (!adminUrl || !env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL (runtime) and, to list tenants, PMS_ADMIN_URL or PMS_MIGRATE_URL.");
    return 2;
  }
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const report = await snapshotAllTenants(admin, env);
    console.log(JSON.stringify(report, null, 2));
    return report.failures.length ? 1 : 0;
  } finally {
    await admin.end();
    await resetDbPoolForTests();
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
