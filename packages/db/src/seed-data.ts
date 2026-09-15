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
  role: "admin" | "user";
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
    entitlements: ["approve_writeoffs"],
    mfaEnrolled: true,
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000012",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-front",
    displayName: "Finn Front",
    role: "user",
    clinicalRole: "unset",
    entitlements: [],
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
