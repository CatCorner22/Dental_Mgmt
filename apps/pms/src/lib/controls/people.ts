import type { Person } from "@pms/controls-engine";
import { CPA_SEAT_CONTROL_ROLE, isCpaSeat } from "../auth/seats";
import { isRole } from "../auth/roles";

export type StaffRow = {
  id: string;
  displayName: string;
  role: string;
  clinicalRole: string;
  entitlements: string[];
  active?: boolean;
  createdAt?: Date | null;
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Whole tenths of a year since the row was created; a floor, not a hire date. */
export function tenureYearsFrom(createdAt: Date | null | undefined, now: Date): number {
  if (!createdAt) return 3;
  const years = (now.getTime() - createdAt.getTime()) / MS_PER_YEAR;
  return Math.max(0, Math.round(years * 10) / 10);
}

/** Maps tenant staff rows to Precog Person records for evaluateRelease and SoD. */
export function staffToPeople(rows: StaffRow[], now: Date = new Date()): Person[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.displayName,
    role: precogRole(row),
    active: row.active ?? true,
    tenureYears: tenureYearsFrom(row.createdAt, now),
  }));
}

/**
 * Precog role label from the app's rank and grants. Dual-release rules name
 * first and second signers by this label, so a person's grants decide what
 * they may initiate or second.
 */
export function precogRole(row: Pick<StaffRow, "role" | "entitlements">): string {
  // The outside accountant first, because the fall-through below reads an
  // ungranted row as "Front Desk Lead" — a role the write-off channel names as
  // a first approver. The seat may neither initiate nor second a release, and
  // no release rule names this label (Increment 1.49).
  if (isRole(row.role) && isCpaSeat({ role: row.role, entitlements: row.entitlements })) {
    return CPA_SEAT_CONTROL_ROLE;
  }
  if (row.role === "admin") return "Owner / Dentist";
  if (row.entitlements.includes("approve_writeoffs")) return "Office Manager";
  if (row.entitlements.includes("post_payments")) return "Billing Specialist";
  return "Front Desk Lead";
}
