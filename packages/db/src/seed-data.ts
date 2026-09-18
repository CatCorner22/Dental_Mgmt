/**
 * Synthetic tenants and staff for local Postgres and AUTH_DEV_MEMORY.
 * Keep in sync with apps/pms/src/lib/auth/devSeed.ts.
 */
export const DEV_PASSWORD = "Dev-password-0.2!";
export const DEV_MFA_SECRET = "JBSWY3DPEHPK3PXP";
export const DEV_RECOVERY_CODE = "dev0-aaaa";

export const DEV_TENANTS = [
  { id: "0196b0a0-0000-7000-8000-000000000001", name: "Ridgeview Family Dental", slug: "ridgeview" },
  { id: "0196b0a0-0000-7000-8000-000000000002", name: "Oakridge Dental", slug: "oakridge" },
] as const;

/** Stable ids for the Ridgeview demo ledger seeded in Increment 1.4. */
export const SEED_APPROVAL = {
  requestId: "0196b0a0-0000-7000-8000-000000000601",
} as const;

export const SEED_BANK = {
  tenantId: DEV_TENANTS[0].id,
  locationId: "0196b0a0-0000-7000-8000-000000000101",
  accountId: "0196b0a0-0000-7000-8000-000000000401",
} as const;

export const SEED_LEDGER = {
  tenantId: DEV_TENANTS[0].id,
  locationId: "0196b0a0-0000-7000-8000-000000000101",
  ownerId: "0196b0a0-0000-7000-8000-000000000011",
  patientJaneId: "0196b0a0-0000-7000-8000-000000000301",
  patientJohnId: "0196b0a0-0000-7000-8000-000000000302",
  accountDoeId: "0196b0a0-0000-7000-8000-000000000311",
  accountSmithId: "0196b0a0-0000-7000-8000-000000000312",
  procedureJaneId: "0196b0a0-0000-7000-8000-000000000321",
  procedureJohnId: "0196b0a0-0000-7000-8000-000000000322",
  chargeJaneId: "0196b0a0-0000-7000-8000-000000000331",
  chargeJohnId: "0196b0a0-0000-7000-8000-000000000332",
  paymentJaneId: "0196b0a0-0000-7000-8000-000000000341",
  memberJaneId: "0196b0a0-0000-7000-8000-000000000351",
  memberJohnId: "0196b0a0-0000-7000-8000-000000000352",
  allocationJaneId: "0196b0a0-0000-7000-8000-000000000361",
  statementJaneId: "0196b0a0-0000-7000-8000-000000000701",
} as const;

export const DEV_LOCATIONS = [
  {
    id: "0196b0a0-0000-7000-8000-000000000101",
    tenantId: DEV_TENANTS[0].id,
    name: "Main",
    timezone: "America/Chicago",
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000201",
    tenantId: DEV_TENANTS[1].id,
    name: "Main",
    timezone: "America/Chicago",
  },
] as const;

export type SeedUserSpec = {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: "admin" | "user" | "readonly";
  clinicalRole: string;
  entitlements: string[];
  /** When false, the user must enroll MFA on first password sign-in. */
  mfaEnrolled: boolean;
};

export const DEV_USERS: readonly SeedUserSpec[] = [
  {
    id: "0196b0a0-0000-7000-8000-000000000011",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-owner",
    displayName: "Riley Owner",
    role: "admin",
    clinicalRole: "dentist",
    entitlements: ["approve_writeoffs", "run_import", "bank_reconcile"],
    mfaEnrolled: true,
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000012",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-front",
    displayName: "Finn Front",
    role: "user",
    clinicalRole: "unset",
    entitlements: ["post_payments", "run_import"],
    mfaEnrolled: true,
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000013",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-newhire",
    displayName: "Nora Newhire",
    role: "user",
    clinicalRole: "unset",
    entitlements: [],
    mfaEnrolled: false,
  },
  {
    // The outside accountant's seat (Increment 1.49): the lowest rank the
    // product has, holding the reporting grant and nothing else, so it reaches
    // the month-end package and no other screen. Its duty pairs with no other
    // in the SoD rulebook, so inviting it creates no conflict; and because it
    // never posts, prepares, or clears, it is the independent reconciler the
    // controls design wants rather than another pair of the practice's hands.
    id: "0196b0a0-0000-7000-8000-000000000014",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-cpa",
    displayName: "Casey Prentice",
    role: "readonly",
    clinicalRole: "unset",
    entitlements: ["view_reports_only"],
    mfaEnrolled: true,
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000021",
    tenantId: DEV_TENANTS[1].id,
    username: "oakridge-owner",
    displayName: "Oak Owner",
    role: "admin",
    clinicalRole: "dentist",
    entitlements: ["approve_writeoffs"],
    mfaEnrolled: true,
  },
];
