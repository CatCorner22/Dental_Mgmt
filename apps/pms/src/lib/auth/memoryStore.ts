import { encryptSecret, type EncryptedBlob } from "@pms/db/crypto";
import { GENESIS_HASH, hashDomainEvent } from "@pms/db";
import { uuidv7 } from "@pms/db";
import { ABSOLUTE_MS, IDLE_MS } from "./ports";
import { hashPassword } from "./password";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_USERS } from "./devSeed";
import { generateRecoveryCodes, hashRecoveryCodes } from "./recovery";
import type { AuthStore, CreateSessionInput, StoredUser, ThrottleRow } from "./store";
import type { SessionRow } from "./types";

export interface MemoryStore extends AuthStore {
  users: Map<string, StoredUser>;
  sessions: Map<string, SessionRow>;
  throttle: Map<string, ThrottleRow>;
  phiLog: unknown[];
  events: { kind: string; payload: unknown }[];
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
  const issuedRecoveryCodes = new Map<string, string[]>();
  for (const seed of DEV_USERS) {
    const codes = generateRecoveryCodes();
    issuedRecoveryCodes.set(seed.id, codes);
    users.set(seed.id, {
      ...seed,
      entitlements: [...seed.entitlements],
      active: true,
      passwordHash,
      mfaSecretEnc,
      mfaEnrolledAt: now,
      recoveryCodeHashes: hashRecoveryCodes(codes, pepper),
      passwordChangedAt: now,
    });
  }

  const sessions = new Map<string, SessionRow>();
  const throttle = new Map<string, ThrottleRow>();
  const lastEventHash = new Map<string, string>();

  const store: MemoryStore = {
    users,
    sessions,
    throttle,
    phiLog: [],
    events: [],
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
    async deactivateUser(userId, at) {
      const user = users.get(userId);
      if (user) users.set(userId, { ...user, active: false });
      await store.revokeSessionsForUser(userId, at);
    },
    async replaceRecoveryHashes(userId, hashes) {
      const user = users.get(userId);
      if (user) users.set(userId, { ...user, recoveryCodeHashes: [...hashes] });
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

let singleton: Promise<MemoryStore> | undefined;

export function resetMemoryStoreSingleton(): void {
  singleton = undefined;
}

export function getMemoryStoreSingleton(
  env: Record<string, string | undefined> = process.env
): Promise<MemoryStore> {
  singleton ??= createMemoryStore({ env });
  return singleton;
}
