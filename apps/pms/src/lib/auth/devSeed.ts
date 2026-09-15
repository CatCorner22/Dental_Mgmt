/** Synthetic staff only. Loaded when AUTH_DEV_MEMORY=1. No patient rows. */
export const DEV_PASSWORD = "Dev-password-0.2!";
export const DEV_MFA_SECRET = "JBSWY3DPEHPK3PXP";

export const DEV_TENANTS = [
  { id: "0196b0a0-0000-7000-8000-000000000001", name: "Ridgeview Family Dental", slug: "ridgeview" },
  { id: "0196b0a0-0000-7000-8000-000000000002", name: "Oakridge Dental", slug: "oakridge" },
] as const;

export const DEV_USERS = [
  {
    id: "0196b0a0-0000-7000-8000-000000000011",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-owner",
    displayName: "Riley Owner",
    role: "admin" as const,
    clinicalRole: "dentist",
    entitlements: ["approve_writeoffs"],
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000012",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-front",
    displayName: "Finn Front",
    role: "user" as const,
    clinicalRole: "unset",
    entitlements: [],
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000021",
    tenantId: DEV_TENANTS[1].id,
    username: "oakridge-owner",
    displayName: "Oak Owner",
    role: "admin" as const,
    clinicalRole: "dentist",
    entitlements: ["approve_writeoffs"],
  },
] as const;
