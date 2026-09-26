import { encryptSecret } from "@pms/db/crypto";
import { generateMfaSecret, mfaEnrollmentUri, verifyMfaCode } from "./totp";
import { generateRecoveryCodes, hashRecoveryCodes } from "./recovery";
import type { AuthStore } from "./store";

/**
 * Pairing an authenticator, first time or again (Increment 1.76).
 *
 * Until now this was a one-way door. `mfaEnrolledAt` is written once and
 * cleared nowhere, both functions here refused an account that carried it, and
 * recovery codes only ever decrease — `generateRecoveryCodes` is called from
 * `completeMfaEnrollment` alone, while `authorize` removes each code as it is
 * burned. Ten sign-ins on codes and a lost phone left an account nobody could
 * ever reach again, the practice owner's included.
 *
 * So an enrolled account may pair again. The authority is the session: it
 * exists only because somebody passed the second factor or spent a recovery
 * code, which is exactly the person a re-pair is for — they have just used
 * their last resort and need a new phone on the account. Asking for the old
 * factor as well would refuse the one case this exists to serve.
 *
 * The live secret is not touched until a code from the new authenticator comes
 * back. `beginMfaEnrollment` stages to `mfaPendingSecretEnc` (migration 0054),
 * so a person who opens the screen and changes their mind still has the factor
 * they arrived with — the same rule the address proof has held since Increment
 * 1.61: nothing becomes the destination until somebody shows they can read
 * from it.
 */

export type EnrollStart = {
  ok: true;
  otpauthUri: string;
  /** True when this pairs over a factor that already works, which the screen says out loud. */
  repairing: boolean;
};
export type EnrollComplete =
  | { ok: true; recoveryCodes: string[]; repaired: boolean }
  | { ok: false; reason: "invalid_code" | "missing_user" };

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
  const secret = generateMfaSecret();
  const secretEnc = encryptSecret(secret, cryptoEnv(env));
  await store.setMfaPendingSecret(userId, secretEnc);
  return { ok: true, otpauthUri: mfaEnrollmentUri(user.username, secret), repairing: user.mfaEnrolledAt !== null };
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
  // The staged authenticator, never the live one: a code from the factor
  // already on the account must not complete a pairing nobody started.
  const staged = await store.getMfaPendingSecret(userId);
  if (!staged) return { ok: false, reason: "invalid_code" };
  const repaired = user.mfaEnrolledAt !== null;

  const pepper = cryptoEnv(env).DEV_MFA_KEY ?? cryptoEnv(env).ENCRYPTION_KEY ?? "";
  const { decryptSecret } = await import("@pms/db/crypto");
  const secret = decryptSecret(staged, cryptoEnv(env));
  if (!verifyMfaCode(user.username, secret, totpCode, now.getTime())) {
    return { ok: false, reason: "invalid_code" };
  }

  // A fresh set replaces whatever is left of the old one, which is what ends
  // the countdown: the supply is restored by the same act that pairs the phone
  // the codes would be used to reach.
  const recoveryCodes = generateRecoveryCodes();
  const recoveryHashes = hashRecoveryCodes(recoveryCodes, pepper);
  await store.completeMfaEnrollment(userId, {
    secretEnc: staged,
    recoveryHashes,
    enrolledAt: now,
  });

  try {
    await store.appendDomainEvent({
      tenantId: user.tenantId,
      actorUserId: user.id,
      // Two acts, two kinds: a first enrolment and a re-pair read differently
      // to anybody auditing who changed a factor and when.
      kind: repaired ? "auth.mfa_repaired" : "auth.mfa_enrolled",
      payload: { username: user.username },
      at: now,
    });
  } catch {
    // Enrollment must not fail if the audit row cannot be written.
  }

  return { ok: true, recoveryCodes, repaired };
}
