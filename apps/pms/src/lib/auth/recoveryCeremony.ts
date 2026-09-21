import { createHash, randomBytes } from "node:crypto";
import { decryptSecret } from "@pms/db/crypto";
import { hashPassword, passwordPolicyError } from "./password";
import type { AuthStore, StoredUser } from "./store";
import { verifyMfaCode } from "./totp";

export const CEREMONY_TTL_MS = 15 * 60 * 1000;

export interface RecoveryCeremonyRow {
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
}

type FailureReason =
  | "not_found"
  | "forbidden"
  | "same_admin"
  | "expired"
  | "already_approved"
  | "not_approved"
  | "already_consumed"
  | "invalid_totp"
  | "invalid_password"
  | "target_inactive"
  | "no_second_admin"
  | "target_cannot_approve";

function cryptoEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  if (env.DEV_MFA_KEY || env.ENCRYPTION_KEY) return env;
  return { ...env, DEV_MFA_KEY: "a".repeat(64) };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function totpOk(user: StoredUser, totp: string, env: Record<string, string | undefined>, now: Date): boolean {
  if (!user.mfaSecretEnc || !user.mfaEnrolledAt) return false;
  const secret = decryptSecret(user.mfaSecretEnc, cryptoEnv(env));
  return verifyMfaCode(user.username, secret, totp, now.getTime());
}

function ceremonyOpen(row: RecoveryCeremonyRow, now: Date): FailureReason | null {
  if (row.consumedAt) return "already_consumed";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  if (row.approvedBy) return "already_approved";
  return null;
}

/**
 * Starts a two-administrator recovery.
 *
 * `eligibleAdmins` is how many administrators of this practice carry a working
 * second factor, counted by the caller from the practice's own rows
 * (`eligibleAdmins` in `regainAccess.ts`). It is a parameter rather than
 * something read here for the reason Increment 1.75 settled on: the acts in
 * this file take a store and nothing else, and a count the caller already
 * holds is cheaper and more testable than a second read.
 *
 * Fewer than two, and the ceremony is refused before it exists (Increment
 * 1.77). `approveRecoveryCeremony` already refuses the initiator, so a
 * single-administrator practice could otherwise open a ceremony that nobody
 * alive could ever approve — a form nobody can complete, which Increments 1.72
 * and 1.74 are both about.
 */
export async function initiateRecoveryCeremony(
  store: AuthStore,
  initiator: StoredUser,
  targetUserId: string,
  totp: string,
  eligibleAdmins: number,
  now: Date,
  env: Record<string, string | undefined> = process.env
): Promise<{ ok: true; ceremonyId: string } | { ok: false; reason: FailureReason }> {
  if (!totpOk(initiator, totp, env, now)) return { ok: false, reason: "invalid_totp" };
  if (initiator.id === targetUserId) return { ok: false, reason: "same_admin" };
  if (eligibleAdmins < 2) return { ok: false, reason: "no_second_admin" };

  const target = await store.getUserById(targetUserId);
  if (!target || !target.active || target.tenantId !== initiator.tenantId) {
    return { ok: false, reason: "forbidden" };
  }

  const id = await store.createRecoveryCeremony({
    tenantId: initiator.tenantId,
    targetUserId,
    initiatedBy: initiator.id,
    initiatedAt: now,
    expiresAt: new Date(now.getTime() + CEREMONY_TTL_MS),
  });
  await store.appendDomainEvent({
    tenantId: initiator.tenantId,
    actorUserId: initiator.id,
    kind: "auth.recovery.initiated",
    payload: { ceremonyId: id, targetUserId },
    at: now,
  });
  return { ok: true, ceremonyId: id };
}

export async function approveRecoveryCeremony(
  store: AuthStore,
  approver: StoredUser,
  ceremonyId: string,
  totp: string,
  now: Date,
  env: Record<string, string | undefined> = process.env
): Promise<{ ok: true; resetToken: string } | { ok: false; reason: FailureReason }> {
  if (!totpOk(approver, totp, env, now)) return { ok: false, reason: "invalid_totp" };

  const row = await store.getRecoveryCeremony(ceremonyId);
  if (!row || row.tenantId !== approver.tenantId) return { ok: false, reason: "not_found" };
  if (row.initiatedBy === approver.id) return { ok: false, reason: "same_admin" };
  /**
   * Nor may the person the recovery is *for* approve it (Increment 1.77).
   *
   * Refusing only the initiator leaves a confused-deputy shape: one
   * administrator starts a recovery against a second, the second approves it
   * believing they are helping a colleague, and the first walks away holding a
   * link into the second's account. The pair would be the attacker and the
   * victim, which is not two independent administrators at all.
   *
   * It costs the honest case nothing. Somebody actually locked out cannot sign
   * in to approve anything, so no real recovery ever reached this line.
   */
  if (row.targetUserId === approver.id) return { ok: false, reason: "target_cannot_approve" };
  const blocked = ceremonyOpen(row, now);
  if (blocked) return { ok: false, reason: blocked };

  const secret = randomBytes(32).toString("base64url");
  const resetToken = `${ceremonyId}.${secret}`;
  await store.approveRecoveryCeremony({
    id: ceremonyId,
    approvedBy: approver.id,
    approvedAt: now,
    resetTokenHash: hashToken(resetToken),
  });
  await store.appendDomainEvent({
    tenantId: approver.tenantId,
    actorUserId: approver.id,
    kind: "auth.recovery.approved",
    payload: { ceremonyId, targetUserId: row.targetUserId },
    at: now,
  });
  return { ok: true, resetToken };
}

export async function consumeRecoveryCeremony(
  store: AuthStore,
  resetToken: string,
  newPassword: string,
  now: Date
): Promise<{ ok: true; username: string } | { ok: false; reason: FailureReason }> {
  const policy = passwordPolicyError(newPassword);
  if (policy) return { ok: false, reason: "invalid_password" };

  const row = await store.getRecoveryCeremonyByTokenHash(resetToken);
  if (!row) return { ok: false, reason: "not_found" };
  if (!row.approvedBy || !row.resetTokenHash) return { ok: false, reason: "not_approved" };
  if (row.consumedAt) return { ok: false, reason: "already_consumed" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  const target = await store.getUserById(row.targetUserId);
  if (!target || !target.active) return { ok: false, reason: "target_inactive" };

  const passwordHash = await hashPassword(newPassword);
  await store.setPassword(row.targetUserId, passwordHash, now);
  /**
   * The second factor goes too (Increment 1.77).
   *
   * Until this, the ceremony reset a password and left the factor standing, so
   * it could not help the one person it exists for: somebody whose
   * authenticator is gone finished the reset and met the same demand for a
   * code they cannot produce. Clearing the enrolment sends them to
   * `/enroll-mfa` on the next sign-in, which Increment 1.76 made work for an
   * account that carried a factor before.
   *
   * So a consumed ceremony always means both — a password set and a factor
   * removed. One act, one event, and its payload says so rather than leaving a
   * reader to infer it from the increment number.
   */
  await store.clearMfaEnrollment(row.targetUserId, now);
  // Which takes the sessions with it, in the same write against Postgres. The
  // separate revoke this line replaced said the same thing twice, and the two
  // could have drifted.
  await store.consumeRecoveryCeremony(row.id, now);
  await store.appendDomainEvent({
    tenantId: row.tenantId,
    actorUserId: row.targetUserId,
    kind: "auth.recovery.consumed",
    payload: {
      ceremonyId: row.id,
      initiatedBy: row.initiatedBy,
      approvedBy: row.approvedBy,
      secondFactorCleared: true,
    },
    at: now,
  });
  // The username, so the page can tell the person what to type at the sign-in
  // box. They arrived on a link and may not have signed in for some time.
  return { ok: true, username: target.username };
}
