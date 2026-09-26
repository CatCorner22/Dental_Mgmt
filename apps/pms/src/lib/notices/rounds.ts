import type { Client } from "pg";
import { eq } from "drizzle-orm";
import { tenants } from "@pms/db";
import { withTenantTransaction } from "../db/client";
import { runNoticeRound, type RoundReport } from "./round";
import { transportFromEnv } from "./transport";

/**
 * One round per practice (Increment 1.62), shaped like the nightly snapshot
 * job beside it: tenants are listed on the administrator connection, because
 * `tenants` is tenant-scoped under RLS and the runtime role cannot enumerate
 * it, and each round then runs on the runtime connection with that tenant
 * bound, exactly as a request would.
 *
 * A failure in one practice never stops the others. That is not politeness: a
 * round is the thing that tells a practice something has gone unattended, so
 * one practice's bad address must not silence every other practice's notices.
 */

export type RoundsReport = {
  ranAt: string;
  tenants: (RoundReport & { tenantId: string })[];
  failures: { tenantId: string; error: string }[];
};

export async function runRoundsForAllTenants(
  admin: Client,
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date(),
  appUrl: string = env.PMS_APP_URL ?? "http://localhost:3000"
): Promise<RoundsReport> {
  const { rows } = await admin.query("SELECT id, name FROM tenants ORDER BY id");
  const report: RoundsReport = { ranAt: now.toISOString(), tenants: [], failures: [] };
  for (const row of rows) {
    const tenantId = String(row.id);
    try {
      const done = await withTenantTransaction(
        tenantId,
        "",
        (db) =>
          runNoticeRound(db, {
            tenantId,
            practiceName: String(row.name ?? "This practice"),
            appUrl,
            transport: transportFromEnv(env as NodeJS.ProcessEnv),
            at: now,
          }),
        env
      );
      report.tenants.push({ tenantId, ...done });
    } catch (error) {
      report.failures.push({ tenantId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
}

/** The practice's own name, for a round driven from inside a request rather than the CLI. */
export async function practiceNameOf(db: Parameters<typeof runNoticeRound>[0], tenantId: string): Promise<string> {
  const rows = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return rows[0]?.name ?? "This practice";
}
