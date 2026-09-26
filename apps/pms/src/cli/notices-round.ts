import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { resetDbPoolForTests } from "../lib/db/client";
import { runRoundsForAllTenants } from "../lib/notices/rounds";

/**
 * pnpm --filter @pms/app notices:round
 *
 * Runs one notice round per tenant: every person with an address in force is
 * sent what their seat owes, unless the message would read exactly as the last
 * one that reached them and that one is less than a week old.
 *
 *   PMS_ADMIN_URL (else PMS_MIGRATE_URL, else POSTGRES_URL): lists tenants.
 *   POSTGRES_URL: the runtime connection each round runs on, tenant-bound.
 *   PMS_NOTICE_TRANSPORT: how messages leave. Unset means nothing leaves, and
 *     every attempt is recorded as a refusal saying so.
 *   PMS_APP_URL: the address the message tells people to sign in at.
 *
 * **Safe to run more often than you need.** The rule that decides whether to
 * send makes a second round a minute later a no-op, so the schedule can be
 * early, late, or doubled by two workers without anybody being told twice.
 * That is deliberate: it lets a practice schedule this with whatever it has —
 * cron, a platform timer, a container that wakes hourly — rather than needing
 * something exact.
 *
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
    const report = await runRoundsForAllTenants(admin, env);
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
