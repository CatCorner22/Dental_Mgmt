import { isRole } from "./roles";
import type { AuthPorts } from "./ports";
import type { AuthStore } from "./store";
import type { FreshUser } from "./types";

export function toFreshUser(user: {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: string;
  clinicalRole: string;
  active: boolean;
  passwordChangedAt: Date;
  mfaEnrolledAt: Date | null;
  entitlements: string[];
}): FreshUser {
  if (!isRole(user.role)) {
    throw new Error("Stored role is not a known rank.");
  }
  return {
    id: user.id,
    tenantId: user.tenantId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    clinicalRole: user.clinicalRole,
    active: user.active,
    passwordChangedAt: user.passwordChangedAt,
    mfaEnrolledAt: user.mfaEnrolledAt,
    entitlements: user.entitlements,
  };
}

export function storePorts(
  store: AuthStore,
  getSessionId: (req: Request) => Promise<string | null>
): AuthPorts {
  return {
    getSessionId,
    getSession: (id) => store.getSession(id),
    async getUser(id) {
      const user = await store.getUserById(id);
      return user ? toFreshUser(user) : null;
    },
    touchSession: (id, lastSeenAt, idleExpiresAt) =>
      store.touchSession(id, lastSeenAt, idleExpiresAt),
    setTenantContext: (tenantId, userId) => store.setTenantContext(tenantId, userId),
    logPhiAccess: (input) => store.logPhiAccess(input),
    recordDisclosure: (input) => store.recordDisclosure(input),
  };
}
