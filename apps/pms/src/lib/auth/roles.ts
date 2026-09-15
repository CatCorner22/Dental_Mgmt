export type Role = "readonly" | "user" | "lead" | "manager" | "admin";

export const ROLE_RANK: Record<Role, number> = {
  readonly: 0,
  user: 1,
  lead: 2,
  manager: 3,
  admin: 4,
};

export function meetsRole(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function isRole(value: string): value is Role {
  return value in ROLE_RANK;
}
