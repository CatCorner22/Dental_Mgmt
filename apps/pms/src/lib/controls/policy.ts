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

export function defaultTenantPolicy(): DualReleasePolicy {
  return mergeDualReleasePolicy({
    enabled: true,
    hardBlockWithoutSecond: false,
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
  const id = uuidv7();
  const now = input.now ?? new Date();
  await db.insert(controlPolicies).values({
    id,
    tenantId: input.tenantId,
    version: 1,
    rulebookVersion: CONTROL_RULEBOOK_VERSION,
    policy: input.policy ?? defaultTenantPolicy(),
    effectiveFrom: now,
    createdAt: now,
    createdById: input.createdById,
    createdByName: input.createdByName,
  });
  return id;
}
