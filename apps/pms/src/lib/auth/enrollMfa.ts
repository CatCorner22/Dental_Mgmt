import { encryptSecret } from "@pms/db/crypto";
import { generateMfaSecret, mfaEnrollmentUri, verifyMfaCode } from "./totp";
import { generateRecoveryCodes, hashRecoveryCodes } from "./recovery";
import type { AuthStore } from "./store";

export type EnrollStart = { ok: true; otpauthUri: string };
export type EnrollComplete =
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; reason: "already_enrolled" | "invalid_code" | "missing_user" };

function cryptoEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  if (env.DEV_MFA_KEY || env.ENCRYPTION_KEY) return env;
  return { ...env, DEV_MFA_KEY: "a".repeat(64) };
}

export async function beginMfaEnrollment(
  store: AuthStore,
  userId: string,
  env: Record<string, string | undefined> = process.env
): Promise<EnrollStart> {
  const user = await store.getUserById(userId);
  if (!user) throw new Error("User not found.");
  if (user.mfaEnrolledAt) throw new Error("MFA is already enrolled.");
  const secret = generateMfaSecret();
  const secretEnc = encryptSecret(secret, cryptoEnv(env));
  await store.setMfaPendingSecret(userId, secretEnc);
  return { ok: true, otpauthUri: mfaEnrollmentUri(user.username, secret) };
}

export async function completeMfaEnrollment(
  store: AuthStore,
  userId: string,
  totpCode: string,
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date()
): Promise<EnrollComplete> {
  const user = await store.getUserById(userId);
  if (!user) return { ok: false, reason: "missing_user" };
  if (user.mfaEnrolledAt) return { ok: false, reason: "already_enrolled" };
  if (!user.mfaSecretEnc) return { ok: false, reason: "invalid_code" };

  const pepper = cryptoEnv(env).DEV_MFA_KEY ?? cryptoEnv(env).ENCRYPTION_KEY ?? "";
  const { decryptSecret } = await import("@pms/db/crypto");
  const secret = decryptSecret(user.mfaSecretEnc, cryptoEnv(env));
  if (!verifyMfaCode(user.username, secret, totpCode, now.getTime())) {
    return { ok: false, reason: "invalid_code" };
  }

  const recoveryCodes = generateRecoveryCodes();
  const recoveryHashes = hashRecoveryCodes(recoveryCodes, pepper);
  await store.completeMfaEnrollment(userId, {
    secretEnc: user.mfaSecretEnc,
    recoveryHashes,
    enrolledAt: now,
  });

  try {
    await store.appendDomainEvent({
      tenantId: user.tenantId,
      actorUserId: user.id,
      kind: "auth.mfa_enrolled",
      payload: { username: user.username },
      at: now,
    });
  } catch {
    // Enrollment must not fail if the audit row cannot be written.
  }

  return { ok: true, recoveryCodes };
}
