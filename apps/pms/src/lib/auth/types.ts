import type { Role } from "./roles";

export interface FreshUser {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: Role;
  clinicalRole: string;
  active: boolean;
  passwordChangedAt: Date;
  mfaEnrolledAt: Date | null;
  entitlements: string[];
}

export interface SessionRow {
  id: string;
  tenantId: string;
  userId: string;
  revokedAt: Date | null;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  lastSeenAt: Date;
  deviceProfile: "desk" | "operatory";
}

export interface PhiRead {
  kind: string;
  ids: string[];
  purpose: string;
}

export interface AccessOpts {
  minRank?: Role;
  entitlements?: string[];
  locationScope?: string;
  phiRead?: PhiRead;
  requireMfa?: boolean;
}

export type AccessResult =
  | { ok: true; user: FreshUser; session: SessionRow }
  | { ok: false; response: Response };
