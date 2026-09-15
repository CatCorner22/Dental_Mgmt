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
  | "target_inactive";

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

export async function initiateRecoveryCeremony(
  store: AuthStore,
  initiator: StoredUser,
  targetUserId: string,
  totp: string,
  now: Date,
  env: Record<string, string | undefined> = process.env
): Promise<{ ok: true; ceremonyId: string } | { ok: false; reason: FailureReason }> {
  if (!totpOk(initiator, totp, env, now)) return { ok: false, reason: "invalid_totp" };
  if (initiator.id === targetUserId) return { ok: false, reason: "same_admin" };

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
): Promise<{ ok: true } | { ok: false; reason: FailureReason }> {
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
  await store.consumeRecoveryCeremony(row.id, now);
  await store.revokeSessionsForUser(row.targetUserId, now);
  await store.appendDomainEvent({
    tenantId: row.tenantId,
    actorUserId: row.targetUserId,
    kind: "auth.recovery.consumed",
    payload: { ceremonyId: row.id, initiatedBy: row.initiatedBy, approvedBy: row.approvedBy },
    at: now,
  });
  return { ok: true };
}
