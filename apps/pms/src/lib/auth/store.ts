import type { EncryptedBlob } from "@pms/db/crypto";
import type { Role } from "./roles";
import type { SessionRow } from "./types";

export interface StoredUser {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: Role;
  clinicalRole: string;
  active: boolean;
  passwordHash: string;
  mfaSecretEnc: EncryptedBlob;
  mfaEnrolledAt: Date | null;
  recoveryCodeHashes: string[];
  passwordChangedAt: Date;
  entitlements: string[];
}

export interface ThrottleRow {
  key: string;
  tenantId: string | null;
  failCount: number;
  firstFailAt: Date;
  lockedUntil: Date | null;
}

export interface CreateSessionInput {
  tenantId: string;
  userId: string;
  deviceProfile: "desk" | "operatory";
  userAgent: string | null;
  now: Date;
}

export interface AuthStore {
  getUserByUsername(username: string): Promise<StoredUser | null>;
  getUserById(id: string): Promise<StoredUser | null>;
  getSession(id: string): Promise<SessionRow | null>;
  createSession(input: CreateSessionInput): Promise<SessionRow>;
  touchSession(id: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void>;
  revokeSessionsForUser(userId: string, at: Date): Promise<number>;
  deactivateUser(userId: string, at: Date): Promise<void>;
  replaceRecoveryHashes(userId: string, hashes: string[]): Promise<void>;
  logPhiAccess(input: {
    tenantId: string;
    userId: string;
    purpose: string;
    recordKind: string;
    recordIds: string[];
    at: Date;
  }): Promise<void>;
  appendDomainEvent(input: {
    tenantId: string;
    actorUserId: string | null;
    kind: string;
    payload: unknown;
    at: Date;
  }): Promise<void>;
  getThrottle(key: string): Promise<ThrottleRow | null>;
  putThrottle(row: ThrottleRow): Promise<ThrottleRow>;
  applyLock(key: string, lockedUntil: Date, now: Date): Promise<ThrottleRow | null>;
  deleteThrottle(key: string): Promise<void>;
  pruneThrottle(now: Date): Promise<void>;
  setTenantContext(tenantId: string, userId: string): Promise<void>;
}
