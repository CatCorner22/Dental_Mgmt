import { decryptSecret } from "@pms/db/crypto";
import { clientIp } from "./clientIp";
import { withHashSlot } from "./hashGate";
import { indexOfRecoveryCode, normalizeRecoveryCode } from "./recovery";
import { timingDummyHash, verifyPassword } from "./password";
import type { AuthStore, StoredUser } from "./store";
import { checkThrottle, clearThrottle, recordFailure } from "./throttleOps";
import { FREE_ATTEMPTS, IP_FREE_ATTEMPTS, IP_MAX_LOCK_MS, loginIpKey, loginPairKey } from "./throttle";
import { verifyMfaCode } from "./totp";

export interface AuthorizeSuccess {
  id: string;
  sessionId: string;
  pwAt: string;
  username: string;
  displayName: string;
  needsMfaEnrollment?: boolean;
}

export type AuthorizeFailure = { ok: false; reason: "credentials" | "busy" | "throttled" };
export type AuthorizeResult = { ok: true; user: AuthorizeSuccess } | AuthorizeFailure;

function cryptoEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  if (env.DEV_MFA_KEY || env.ENCRYPTION_KEY) return env;
  return { ...env, DEV_MFA_KEY: "a".repeat(64) };
}

function deviceProfile(req: Request | undefined): "desk" | "operatory" {
  const raw = req?.headers.get("x-device-profile") ?? "";
  return raw === "operatory" ? "operatory" : "desk";
}

async function chargeFailure(
  store: AuthStore,
  pairKey: string | null,
  ip: string | null,
  now: Date
): Promise<void> {
  if (!pairKey || !ip) return;
  await recordFailure(store, pairKey, now, FREE_ATTEMPTS, IP_MAX_LOCK_MS);
  await recordFailure(store, loginIpKey(ip), now, IP_FREE_ATTEMPTS, IP_MAX_LOCK_MS);
}

function secondFactorOk(
  user: StoredUser,
  totpCode: string,
  env: Record<string, string | undefined>,
  now: Date
): { totp: boolean; recoveryIndex: number } {
  if (!user.mfaSecretEnc) return { totp: false, recoveryIndex: -1 };
  const secret = decryptSecret(user.mfaSecretEnc, cryptoEnv(env));
  const totp = verifyMfaCode(user.username, secret, totpCode, now.getTime());
  if (totp) return { totp: true, recoveryIndex: -1 };
  const pepper = cryptoEnv(env).DEV_MFA_KEY ?? cryptoEnv(env).ENCRYPTION_KEY ?? "";
  if (normalizeRecoveryCode(totpCode).length < 8) return { totp: false, recoveryIndex: -1 };
  return {
    totp: false,
    recoveryIndex: indexOfRecoveryCode(totpCode, user.recoveryCodeHashes, pepper),
  };
}

export async function authorizeCredentials(
  store: AuthStore,
  creds: { username?: unknown; password?: unknown; totp?: unknown },
  request: Request | undefined,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env
): Promise<AuthorizeResult> {
  const username = typeof creds.username === "string" ? creds.username.trim() : "";
  const password = typeof creds.password === "string" ? creds.password : "";
  const totpCode = typeof creds.totp === "string" ? creds.totp.trim() : "";
  if (!username || !password) return { ok: false, reason: "credentials" };

  const ip = clientIp(request);
  const pairKey = ip ? loginPairKey(ip, username) : null;
  if (pairKey) {
    const gate = await checkThrottle(store, pairKey, now);
    if (gate.locked) return { ok: false, reason: "throttled" };
  }

  const user = await store.getUserByUsername(username);
  const slot = await withHashSlot(() =>
    verifyPassword(password, user && user.active ? user.passwordHash : timingDummyHash())
  );
  if (!slot.ok) return { ok: false, reason: "busy" };

  if (!user || !user.active) {
    await chargeFailure(store, pairKey, ip, now);
    return { ok: false, reason: "credentials" };
  }
  if (!slot.value) {
    await chargeFailure(store, pairKey, ip, now);
    return { ok: false, reason: "credentials" };
  }

  if (!user.mfaEnrolledAt) {
    if (pairKey) await clearThrottle(store, pairKey);
    const session = await store.createSession({
      tenantId: user.tenantId,
      userId: user.id,
      deviceProfile: deviceProfile(request),
      userAgent: request?.headers.get("user-agent") ?? null,
      now,
    });
    try {
      await store.appendDomainEvent({
        tenantId: user.tenantId,
        actorUserId: user.id,
        kind: "auth.signin.pending_mfa",
        payload: { username: user.username, sessionId: session.id },
        at: now,
      });
    } catch {
      // A missing audit row must not become a lockout.
    }
    return {
      ok: true,
      user: {
        id: user.id,
        sessionId: session.id,
        pwAt: user.passwordChangedAt.toISOString(),
        username: user.username,
        displayName: user.displayName,
        needsMfaEnrollment: true,
      },
    };
  }

  const factor = secondFactorOk(user, totpCode, env, now);
  if (!factor.totp && factor.recoveryIndex < 0) {
    await chargeFailure(store, pairKey, ip, now);
    return { ok: false, reason: "credentials" };
  }

  if (factor.recoveryIndex >= 0) {
    const remaining = user.recoveryCodeHashes.filter((_, i) => i !== factor.recoveryIndex);
    await store.replaceRecoveryHashes(user.id, remaining);
  }

  if (pairKey) await clearThrottle(store, pairKey);

  const session = await store.createSession({
    tenantId: user.tenantId,
    userId: user.id,
    deviceProfile: deviceProfile(request),
    userAgent: request?.headers.get("user-agent") ?? null,
    now,
  });

  try {
    await store.appendDomainEvent({
      tenantId: user.tenantId,
      actorUserId: user.id,
      kind: "auth.signin",
      payload: { username: user.username, sessionId: session.id },
      at: now,
    });
  } catch {
    // A missing audit row must not become a lockout.
  }

  return {
    ok: true,
    user: {
      id: user.id,
      sessionId: session.id,
      pwAt: user.passwordChangedAt.toISOString(),
      username: user.username,
      displayName: user.displayName,
    },
  };
}
