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

/** Accounting-of-disclosures row written when PHI leaves the practice. */
export interface PhiDisclosure {
  patientId: string;
  channel: string;
  recipient: string;
  recordIds: string[];
  purpose: string;
  documentId?: string | null;
}

export interface AccessOpts {
  minRank?: Role;
  /**
   * An entitlement that opens the route on its own, in place of `minRank`
   * (Increment 1.49). A screen whose point is a duty rather than a seniority
   * needs this: the outside accountant sits below every rank and reaches the
   * month-end package by holding one grant. It relaxes `minRank` only;
   * `entitlements` below still has to be held in full.
   */
  orEntitlement?: string;
  entitlements?: string[];
  locationScope?: string;
  phiRead?: PhiRead;
  /** When set, appends a disclosure row in the same request as the guarded handler. */
  disclosure?: PhiDisclosure;
  requireMfa?: boolean;
}

export type AccessResult =
  | { ok: true; user: FreshUser; session: SessionRow }
  | { ok: false; response: Response };
