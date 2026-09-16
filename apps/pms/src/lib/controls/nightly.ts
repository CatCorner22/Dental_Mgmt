import type { Client } from "pg";
import { withTenantTransaction } from "../db/client";
import { takeSnapshot } from "./snapshots";

export type NightlySnapshotReport = {
  ranAt: string;
  tenants: {
    tenantId: string;
    snapshotId: string;
    averageResidual: number;
    cosoOverall: number;
    openConflicts: number;
    conflictsWithoutDecision: number;
    unmitigatedCritical: number;
  }[];
  failures: { tenantId: string; error: string }[];
};

/**
 * One frozen snapshot per tenant, with the findings table refreshed on the
 * way. Tenants are listed on the administrator connection (tenants is
 * tenant-scoped under RLS, so the runtime role cannot enumerate them); the
 * scoring itself runs per tenant on the runtime connection with the tenant
 * bound, exactly as a request would. A failure in one tenant never stops
 * the others.
 */
export async function snapshotAllTenants(
  admin: Client,
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date()
): Promise<NightlySnapshotReport> {
  const { rows } = await admin.query("SELECT id FROM tenants ORDER BY id");
  const report: NightlySnapshotReport = { ranAt: now.toISOString(), tenants: [], failures: [] };
  for (const row of rows) {
    const tenantId = String(row.id);
    try {
      const stored = await withTenantTransaction(
        tenantId,
        "",
        (db) => takeSnapshot(db, { tenantId, trigger: "nightly", now }),
        env
      );
      const h = stored.snapshot.headline;
      report.tenants.push({
        tenantId,
        snapshotId: stored.id,
        averageResidual: h.averageResidual,
        cosoOverall: h.cosoOverall,
        openConflicts: h.openConflicts,
        conflictsWithoutDecision: h.conflictsWithoutDecision,
        unmitigatedCritical: h.unmitigatedCritical,
      });
    } catch (error) {
      report.failures.push({ tenantId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
}
