import { encryptSecret, type EncryptedBlob } from "@pms/db/crypto";
import { GENESIS_HASH, hashDomainEvent } from "@pms/db";
import { uuidv7 } from "@pms/db";
import { ABSOLUTE_MS, IDLE_MS } from "./ports";
import { hashPassword } from "./password";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_RECOVERY_CODE, DEV_USERS } from "./devSeed";
import { generateRecoveryCodes, hashRecoveryCodes } from "./recovery";
import type { AuthStore, CreateSessionInput, StoredUser, ThrottleRow } from "./store";
import type { SessionRow } from "./types";

type CeremonyRow = {
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
};

export interface MemoryStore extends AuthStore {
  users: Map<string, StoredUser>;
  sessions: Map<string, SessionRow>;
  throttle: Map<string, ThrottleRow>;
  phiLog: unknown[];
  events: { kind: string; payload: unknown }[];
  disclosures: unknown[];
  ceremonies: Map<string, CeremonyRow>;
  tenantSets: string[];
  lastEventHash: Map<string, string>;
  issuedRecoveryCodes: Map<string, string[]>;
}

function envForCrypto(env: Record<string, string | undefined>): Record<string, string | undefined> {
  if (env.DEV_MFA_KEY || env.ENCRYPTION_KEY) return env;
  return { ...env, DEV_MFA_KEY: "a".repeat(64) };
}

export async function createMemoryStore(
  options: {
    password?: string;
    mfaSecret?: string;
    env?: Record<string, string | undefined>;
    now?: Date;
  } = {}
): Promise<MemoryStore> {
  const now = options.now ?? new Date("2026-09-15T12:00:00.000Z");
  const password = options.password ?? DEV_PASSWORD;
  const mfaSecret = options.mfaSecret ?? DEV_MFA_SECRET;
  const cryptoEnv = envForCrypto(options.env ?? process.env);
  const passwordHash = await hashPassword(password);
  const mfaSecretEnc: EncryptedBlob = encryptSecret(mfaSecret, cryptoEnv);
  const pepper = cryptoEnv.DEV_MFA_KEY ?? cryptoEnv.ENCRYPTION_KEY ?? "a".repeat(64);

  const users = new Map<string, StoredUser>();
  /** Authenticators being paired, kept off the user so no lookup can serve one. */
  const pendingSecrets = new Map<string, EncryptedBlob>();
  const issuedRecoveryCodes = new Map<string, string[]>();
  for (const seed of DEV_USERS) {
    const enrolled = seed.mfaEnrolled;
    const codes = enrolled ? [DEV_RECOVERY_CODE, ...generateRecoveryCodes()] : [];
    if (enrolled) issuedRecoveryCodes.set(seed.id, codes);
    users.set(seed.id, {
      id: seed.id,
      tenantId: seed.tenantId,
      username: seed.username,
      displayName: seed.displayName,
      role: seed.role,
      clinicalRole: seed.clinicalRole,
      entitlements: [...seed.entitlements],
      active: true,
      passwordHash,
      mfaSecretEnc: enrolled ? mfaSecretEnc : null,
      mfaEnrolledAt: enrolled ? now : null,
      recoveryCodeHashes: enrolled ? hashRecoveryCodes(codes, pepper) : [],
      passwordChangedAt: now,
    });
  }

  const sessions = new Map<string, SessionRow>();
  const throttle = new Map<string, ThrottleRow>();
  const lastEventHash = new Map<string, string>();
  const ceremonies = new Map<string, CeremonyRow>();

  const store: MemoryStore = {
    users,
    sessions,
    throttle,
    phiLog: [],
    events: [],
    disclosures: [],
    ceremonies,
    tenantSets: [],
    lastEventHash,
    issuedRecoveryCodes,
    async getUserByUsername(username) {
      const needle = username.toLowerCase();
      for (const user of users.values()) {
        if (user.username.toLowerCase() === needle) return { ...user, entitlements: [...user.entitlements], recoveryCodeHashes: [...user.recoveryCodeHashes] };
      }
      return null;
    },
    async getUserById(id) {
      const user = users.get(id);
      return user
        ? { ...user, entitlements: [...user.entitlements], recoveryCodeHashes: [...user.recoveryCodeHashes] }
        : null;
    },
    async getSession(id) {
      const session = sessions.get(id);
      return session ? { ...session } : null;
    },
    async createSession(input: CreateSessionInput) {
      const idle = IDLE_MS[input.deviceProfile];
      const session: SessionRow = {
        id: uuidv7(input.now.getTime()),
        tenantId: input.tenantId,
        userId: input.userId,
        revokedAt: null,
        idleExpiresAt: new Date(input.now.getTime() + idle),
        absoluteExpiresAt: new Date(input.now.getTime() + ABSOLUTE_MS),
        lastSeenAt: input.now,
        deviceProfile: input.deviceProfile,
      };
      sessions.set(session.id, session);
      return { ...session };
    },
    async touchSession(id, lastSeenAt, idleExpiresAt) {
      const session = sessions.get(id);
      if (session) sessions.set(id, { ...session, lastSeenAt, idleExpiresAt });
    },
    async revokeSessionsForUser(userId, at) {
      let n = 0;
      for (const [id, session] of sessions) {
        if (session.userId === userId && !session.revokedAt) {
          sessions.set(id, { ...session, revokedAt: at });
          n += 1;
        }
      }
      return n;
    },
    async revokeSessionsForTenant(tenantId, at) {
      let n = 0;
      for (const [id, session] of sessions) {
        if (session.tenantId === tenantId && !session.revokedAt) {
          sessions.set(id, { ...session, revokedAt: at });
          n += 1;
        }
      }
      return n;
    },
    async deactivateUser(userId, at) {
      const user = users.get(userId);
      if (user) users.set(userId, { ...user, active: false });
      await store.revokeSessionsForUser(userId, at);
    },
    async replaceRecoveryHashes(userId, hashes) {
      const user = users.get(userId);
      if (user) users.set(userId, { ...user, recoveryCodeHashes: [...hashes] });
    },
    async getMfaPendingSecret(userId) {
      return pendingSecrets.get(userId) ?? null;
    },
    async setMfaPendingSecret(userId, secretEnc) {
      if (!users.has(userId)) return;
      pendingSecrets.set(userId, secretEnc);
    },
    async completeMfaEnrollment(userId, input) {
      const user = users.get(userId);
      if (!user) return;
      users.set(userId, {
        ...user,
        mfaSecretEnc: input.secretEnc,
        mfaEnrolledAt: input.enrolledAt,
        recoveryCodeHashes: [...input.recoveryHashes],
      });
      // A pairing is in progress or finished, never both.
      pendingSecrets.delete(userId);
    },
    async logPhiAccess(input) {
      store.phiLog.push(input);
    },
    async appendDomainEvent(input) {
      const prev = lastEventHash.get(input.tenantId) ?? GENESIS_HASH;
      const hash = hashDomainEvent({
        prevHash: prev,
        tenantId: input.tenantId,
        kind: input.kind,
        payload: input.payload,
        occurredAt: input.at.toISOString(),
      });
      lastEventHash.set(input.tenantId, hash);
      store.events.push({ kind: input.kind, payload: input.payload });
    },
    async recordDisclosure(input) {
      const id = uuidv7(input.at.getTime());
      store.disclosures.push({ id, ...input });
      return id;
    },
    async createRecoveryCeremony(input) {
      const id = uuidv7(input.initiatedAt.getTime());
      ceremonies.set(id, {
        id,
        tenantId: input.tenantId,
        targetUserId: input.targetUserId,
        initiatedBy: input.initiatedBy,
        approvedBy: null,
        initiatedAt: input.initiatedAt,
        approvedAt: null,
        expiresAt: input.expiresAt,
        consumedAt: null,
        resetTokenHash: null,
      });
      return id;
    },
    async getRecoveryCeremony(id) {
      const row = ceremonies.get(id);
      return row ? { ...row } : null;
    },
    async getRecoveryCeremonyByTokenHash(resetToken) {
      const dot = resetToken.indexOf(".");
      if (dot <= 0) return null;
      const row = ceremonies.get(resetToken.slice(0, dot));
      if (!row?.resetTokenHash) return null;
      const { createHash } = await import("node:crypto");
      const digest = createHash("sha256").update(resetToken).digest("hex");
      return row.resetTokenHash === digest ? { ...row } : null;
    },
    async approveRecoveryCeremony(input) {
      const row = ceremonies.get(input.id);
      if (!row) return;
      ceremonies.set(input.id, {
        ...row,
        approvedBy: input.approvedBy,
        approvedAt: input.approvedAt,
        resetTokenHash: input.resetTokenHash,
      });
    },
    async consumeRecoveryCeremony(id, consumedAt) {
      const row = ceremonies.get(id);
      if (!row) return;
      ceremonies.set(id, { ...row, consumedAt });
    },
    async setPassword(userId, passwordHash, passwordChangedAt) {
      const user = users.get(userId);
      if (!user) return;
      users.set(userId, { ...user, passwordHash, passwordChangedAt });
    },
    async getThrottle(key) {
      const row = throttle.get(key);
      return row ? { ...row } : null;
    },
    async putThrottle(row) {
      throttle.set(row.key, { ...row });
      return { ...row };
    },
    async applyLock(key, lockedUntil, now) {
      const row = throttle.get(key);
      if (!row) return null;
      if (row.lockedUntil && row.lockedUntil.getTime() > now.getTime()) return null;
      const next = { ...row, lockedUntil };
      throttle.set(key, next);
      return { ...next };
    },
    async deleteThrottle(key) {
      throttle.delete(key);
    },
    async pruneThrottle(now) {
      const windowStart = now.getTime() - 15 * 60 * 1000;
      for (const [key, row] of throttle) {
        const lockDead = !row.lockedUntil || row.lockedUntil.getTime() < now.getTime();
        if (row.firstFailAt.getTime() < windowStart && lockDead) throttle.delete(key);
      }
    },
    async setTenantContext(tenantId, userId) {
      store.tenantSets.push(`${tenantId}:${userId}`);
    },
  };

  return store;
}

const globalStore = globalThis as typeof globalThis & {
  __pmsMemoryStore?: Promise<MemoryStore>;
};

export function resetMemoryStoreSingleton(): void {
  globalStore.__pmsMemoryStore = undefined;
}

export function getMemoryStoreSingleton(
  env: Record<string, string | undefined> = process.env
): Promise<MemoryStore> {
  globalStore.__pmsMemoryStore ??= createMemoryStore({ env });
  return globalStore.__pmsMemoryStore;
}
