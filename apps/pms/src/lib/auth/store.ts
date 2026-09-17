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
  mfaSecretEnc: EncryptedBlob | null;
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
  revokeSessionsForTenant(tenantId: string, at: Date): Promise<number>;
  deactivateUser(userId: string, at: Date): Promise<void>;
  replaceRecoveryHashes(userId: string, hashes: string[]): Promise<void>;
  setMfaPendingSecret(userId: string, secretEnc: EncryptedBlob): Promise<void>;
  completeMfaEnrollment(
    userId: string,
    input: { secretEnc: EncryptedBlob; recoveryHashes: string[]; enrolledAt: Date }
  ): Promise<void>;
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
  recordDisclosure(input: {
    tenantId: string;
    patientId: string;
    channel: string;
    recipient: string;
    recordIds: string[];
    purpose: string;
    actorUserId: string;
    actorName: string;
    documentId: string | null;
    at: Date;
  }): Promise<string>;
  createRecoveryCeremony(input: {
    tenantId: string;
    targetUserId: string;
    initiatedBy: string;
    initiatedAt: Date;
    expiresAt: Date;
  }): Promise<string>;
  getRecoveryCeremony(id: string): Promise<{
    id: string;
    tenantId: string;
    targetUserId: string;
    initiatedBy: string;
    approvedBy: string | null;
    initiatedAt: Date;
    approvedAt: Date | null;
    expiresAt: Date;
    consumedAt: Date | null;
    resetTokenHash: string | null;
  } | null>;
  getRecoveryCeremonyByTokenHash(resetToken: string): Promise<{
    id: string;
    tenantId: string;
    targetUserId: string;
    initiatedBy: string;
    approvedBy: string | null;
    initiatedAt: Date;
    approvedAt: Date | null;
    expiresAt: Date;
    consumedAt: Date | null;
    resetTokenHash: string | null;
  } | null>;
  approveRecoveryCeremony(input: {
    id: string;
    approvedBy: string;
    approvedAt: Date;
    resetTokenHash: string;
  }): Promise<void>;
  consumeRecoveryCeremony(id: string, consumedAt: Date): Promise<void>;
  setPassword(userId: string, passwordHash: string, passwordChangedAt: Date): Promise<void>;
  /**
   * Records the TOTP step that just signed the user in. Resolves false when
   * that step, or a later one, was already accepted: the code is a replay.
   */
  consumeMfaStep(userId: string, step: number): Promise<boolean>;
  getThrottle(key: string): Promise<ThrottleRow | null>;
  putThrottle(row: ThrottleRow): Promise<ThrottleRow>;
  applyLock(key: string, lockedUntil: Date, now: Date): Promise<ThrottleRow | null>;
  deleteThrottle(key: string): Promise<void>;
  pruneThrottle(now: Date): Promise<void>;
  setTenantContext(tenantId: string, userId: string): Promise<void>;
}
