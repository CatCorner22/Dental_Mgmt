import { eq } from "drizzle-orm";
import type { GrantRow, Person } from "@pms/controls-engine";
import { isLiveGrant, userEntitlements, users } from "@pms/db";
import type { AppDb } from "../db/client";
import { precogRole, staffToPeople, type StaffRow } from "./people";

export type EntitlementGrant = {
  id: string;
  userId: string;
  entitlement: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  grantedBy: string | null;
  reason: string | null;
  decisionId: string | null;
};

export type LoadedStaff = {
  rows: (StaffRow & { active: boolean; createdAt: Date })[];
  /** Every user in the tenant, active flag preserved. */
  people: Person[];
  /** Every entitlement row, live or not; the engine filters by date. */
  grants: GrantRow[];
  grantRows: EntitlementGrant[];
};

/** The same rule the authorization path applies (Increment 1.86), borrowed rather than restated. */
const isLive = isLiveGrant;

/** Two queries, joined in memory: users and their entitlement rows. */
export async function loadStaff(db: AppDb, tenantId: string, now: Date = new Date()): Promise<LoadedStaff> {
  const userRows = await db.select().from(users).where(eq(users.tenantId, tenantId));
  const entRows = await db.select().from(userEntitlements).where(eq(userEntitlements.tenantId, tenantId));

  const grantRows: EntitlementGrant[] = entRows.map((e) => ({
    id: e.id,
    userId: e.userId,
    entitlement: e.entitlement,
    effectiveFrom: e.effectiveFrom,
    effectiveTo: e.effectiveTo,
    grantedBy: e.grantedBy,
    reason: e.reason,
    decisionId: e.decisionId,
  }));

  const rows = userRows.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    role: u.role,
    clinicalRole: u.clinicalRole,
    active: u.active,
    createdAt: u.createdAt,
    entitlements: grantRows
      .filter((g) => g.userId === u.id && isLive(g, now))
      .map((g) => g.entitlement),
  }));

  const people = staffToPeople(rows, now);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const grants: GrantRow[] = grantRows
    .filter((g) => byId.has(g.userId) && isLive(g, now))
    .map((g) => {
      const row = byId.get(g.userId)!;
      return {
        personId: g.userId,
        personName: row.displayName,
        role: precogRole(row),
        entitlement: g.entitlement,
        effectiveFrom: g.effectiveFrom.toISOString(),
        effectiveTo: g.effectiveTo ? g.effectiveTo.toISOString() : null,
      };
    });

  return { rows, people, grants, grantRows };
}
