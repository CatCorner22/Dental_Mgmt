/**
 * Envelope encryption for MFA secrets (and later SSNs, member ids, bank ids).
 * Increment 0.1: a local AES-256-GCM key from DEV_MFA_KEY or ENCRYPTION_KEY.
 * Production replaces the local key with a KMS data key per tenant.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";

export interface EncryptedBlob {
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

function keyFromEnv(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env.DEV_MFA_KEY ?? env.ENCRYPTION_KEY;
  if (!raw || !raw.trim()) {
    throw new Error("DEV_MFA_KEY or ENCRYPTION_KEY is required to wrap secrets.");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    return Buffer.from(raw.trim(), "hex");
  }
  return scryptSync(raw, "pms-mfa-envelope-v1", 32);
}

export function encryptSecret(
  plain: string,
  env: Record<string, string | undefined> = process.env
): EncryptedBlob {
  const key = keyFromEnv(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptSecret(
  blob: EncryptedBlob,
  env: Record<string, string | undefined> = process.env
): string {
  if (blob.alg !== "aes-256-gcm") {
    throw new Error("Unsupported envelope algorithm.");
  }
  const key = keyFromEnv(env);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
