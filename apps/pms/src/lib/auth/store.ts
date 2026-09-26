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
  /**
   * Stages an authenticator being paired. It goes to `mfaPendingSecretEnc` and
   * never to the live secret (Increment 1.76): a person re-pairing must keep
   * the factor that works until the new one proves itself, or merely opening
   * the screen would lock them out.
   */
  setMfaPendingSecret(userId: string, secretEnc: EncryptedBlob): Promise<void>;
  /**
   * The authenticator being paired, if one is. Deliberately not a field on
   * `StoredUser`: neither auth lookup returns the column, so the paths that
   * resolve a person for a sign-in or a guard cannot hand a pairing in
   * progress to anybody, and only the enrolment path asks for it.
   */
  getMfaPendingSecret(userId: string): Promise<EncryptedBlob | null>;
  /**
   * Promotes the staged authenticator and replaces the recovery codes. Clears
   * the pending column in the same write, so a pairing is either in progress
   * or finished and never both.
   */
  completeMfaEnrollment(
    userId: string,
    input: { secretEnc: EncryptedBlob; recoveryHashes: string[]; enrolledAt: Date }
  ): Promise<void>;
  /**
   * Puts an account back to having no second factor at all (Increment 1.77):
   * no live secret, no pairing in progress, no enrolment date, no recovery
   * codes. One write, because a half-cleared account is worse than either end
   * of it — an enrolment date with no secret makes `needsMfaEnrollment` false
   * and every code refused, so the person can neither pass the factor nor be
   * sent to set a new one.
   *
   * The account's sessions go with it: a person whose factor was just removed
   * by somebody else must not keep a session minted under the old one. That is
   * part of this rather than a second call beside it, so the two cannot drift
   * and, against Postgres, so both land in one transaction.
   *
   * Only the two-administrator recovery ceremony calls this. Nothing a single
   * person can reach clears somebody else's factor.
   */
  clearMfaEnrollment(userId: string, at: Date): Promise<void>;
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
