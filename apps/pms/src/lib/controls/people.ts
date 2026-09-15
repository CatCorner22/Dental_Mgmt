import type { Person } from "@pms/controls-engine";

type StaffRow = {
  id: string;
  displayName: string;
  role: string;
  clinicalRole: string;
  entitlements: string[];
};

/** Maps tenant staff rows to Precog Person records for evaluateRelease. */
export function staffToPeople(rows: StaffRow[]): Person[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.displayName,
    role: precogRole(row),
    active: true,
    tenureYears: 3,
  }));
}

function precogRole(row: StaffRow): string {
  if (row.role === "admin") return "Owner / Dentist";
  if (row.entitlements.includes("approve_writeoffs")) return "Office Manager";
  if (row.entitlements.includes("post_payments")) return "Billing Specialist";
  return "Front Desk Lead";
}
