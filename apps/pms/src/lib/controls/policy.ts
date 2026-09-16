import { eq, desc } from "drizzle-orm";
import {
  CONTROL_RULEBOOK_VERSION,
  type DualReleasePolicy,
  mergeDualReleasePolicy,
} from "@pms/controls-engine";
import { controlPolicies, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";

export type ActivePolicy = {
  id: string;
  version: number;
  rulebookVersion: string;
  policy: DualReleasePolicy;
};

export async function loadActivePolicy(db: AppDb, tenantId: string): Promise<ActivePolicy | null> {
  const rows = await db
    .select()
    .from(controlPolicies)
    .where(eq(controlPolicies.tenantId, tenantId))
    .orderBy(desc(controlPolicies.version))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    rulebookVersion: row.rulebookVersion,
    policy: row.policy as DualReleasePolicy,
  };
}

/**
 * A new tenant starts with every channel on, held postings instead of hard
 * blocks, and no exceptions. The engine's sample exceptions are demo data;
 * a real exception arrives only through addException with an owner's
 * reason, residual note, and window.
 */
export function defaultTenantPolicy(): DualReleasePolicy {
  return mergeDualReleasePolicy({
    enabled: true,
    hardBlockWithoutSecond: false,
    exceptions: [],
  });
}

export async function seedControlPolicy(
  db: AppDb,
  input: {
    tenantId: string;
    createdById: string;
    createdByName: string;
    policy?: DualReleasePolicy;
    now?: Date;
  }
): Promise<string> {
  return writePolicyVersion(db, {
    tenantId: input.tenantId,
    version: 1,
    policy: input.policy ?? defaultTenantPolicy(),
    createdById: input.createdById,
    createdByName: input.createdByName,
    now: input.now,
  });
}

/**
 * control_policies is append-only: every change is a new version row.
 * The unique (tenant_id, version) index refuses two writers racing for
 * the same next version; the caller retries or reports a conflict.
 */
export async function writePolicyVersion(
  db: AppDb,
  input: {
    tenantId: string;
    version: number;
    policy: DualReleasePolicy;
    createdById: string;
    createdByName: string;
    now?: Date;
  }
): Promise<string> {
  const id = uuidv7();
  const now = input.now ?? new Date();
  await db.insert(controlPolicies).values({
    id,
    tenantId: input.tenantId,
    version: input.version,
    rulebookVersion: CONTROL_RULEBOOK_VERSION,
    policy: { ...input.policy, updatedAt: now.toISOString() },
    effectiveFrom: now,
    createdAt: now,
    createdById: input.createdById,
    createdByName: input.createdByName,
  });
  return id;
}
