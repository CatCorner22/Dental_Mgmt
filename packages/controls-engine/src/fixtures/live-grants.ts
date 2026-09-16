/**
 * Live-grant fixture for the builder, grant, and snapshot tests.
 * Test-only; production modules must not import this file.
 */
import type { DualReleasePolicy } from "../controls/dual-release";
import { mergeDualReleasePolicy } from "../controls/dual-release";
import type { EnforcementByChannel } from "../coverage";
import type { ControlDecision } from "../decisions";
import type { GrantRow } from "../grants";
import type { Person } from "../types";

export const AS_OF = "2026-09-16";
export const TAKEN_AT = "2026-09-16T12:00:00.000Z";

export const livePeople: Person[] = [
  { id: "u-owner", name: "Dr. Reagan", role: "Owner / Dentist", active: true, tenureYears: 12 },
  { id: "u-om", name: "Maya Chen", role: "Office Manager", active: true, tenureYears: 7 },
  { id: "u-front", name: "Jordan Blake", role: "Front Desk Lead", active: true, tenureYears: 5 },
  { id: "u-bill", name: "Chris Patel", role: "Billing Specialist", active: true, tenureYears: 3 },
  { id: "u-hyg", name: "Sam Ortiz", role: "Hygienist", active: true, tenureYears: 4 },
  { id: "u-gone", name: "Former Staff", role: "Front Desk Lead", active: false, tenureYears: 1 },
];

function g(personId: string, entitlement: string, effectiveTo?: string): GrantRow {
  const p = livePeople.find((x) => x.id === personId)!;
  return {
    personId,
    personName: p.name,
    role: p.role,
    entitlement,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: effectiveTo ?? null,
  };
}

export const liveGrants: GrantRow[] = [
  g("u-owner", "approve_writeoffs"),
  g("u-owner", "approve_vendor"),
  g("u-owner", "approve_payroll"),
  g("u-owner", "pms_admin_roles"),
  g("u-om", "post_payments"),
  g("u-om", "prepare_deposit"),
  g("u-om", "post_adjustments"),
  g("u-om", "create_vendor"),
  g("u-om", "release_payment"),
  g("u-om", "enter_payroll"),
  g("u-front", "collect_cash"),
  g("u-front", "post_payments"),
  g("u-bill", "submit_claims"),
  g("u-bill", "post_adjustments"),
  g("u-bill", "approve_writeoffs"),
  // Expired grant: must not count.
  g("u-bill", "bank_reconcile", "2026-06-30T00:00:00.000Z"),
  // Unknown vocabulary from an older seed: reported, never scored.
  g("u-hyg", "view_schedule"),
];

/** Ledger kinds map to ACH, check, and write-off. The rest is not held yet. */
export const ENFORCEMENT_INCREMENT_1_12: EnforcementByChannel = {
  ach: "enforced",
  check: "enforced",
  writeoff: "enforced",
  deposit: "external",
  vendor_new: "external",
  payroll: "external",
};

export function livePolicy(overrides?: Partial<DualReleasePolicy>): DualReleasePolicy {
  return mergeDualReleasePolicy({
    enabled: true,
    hardBlockWithoutSecond: false,
    exceptions: [],
    ...overrides,
  });
}

export const liveDecisions: ControlDecision[] = [
  {
    id: "dec-1",
    subjectKind: "sod_finding",
    subjectId: "u-om:rule-vendor-create-pay",
    kind: "compensate",
    note: "Owner reviews the new-vendor list and every ACH batch above $500 monthly.",
    reviewBy: "2026-12-01",
    decidedById: "u-owner",
    decidedByName: "Dr. Reagan",
    decidedAt: "2026-09-01T09:00:00.000Z",
  },
  {
    id: "dec-2",
    subjectKind: "sod_finding",
    subjectId: "u-bill:rule-writeoff",
    kind: "accept_residual",
    note: "Billing posts and approves small adjustments; owner signs the monthly exception report.",
    reviewBy: "2026-08-01",
    decidedById: "u-owner",
    decidedByName: "Dr. Reagan",
    decidedAt: "2026-05-01T09:00:00.000Z",
  },
];
