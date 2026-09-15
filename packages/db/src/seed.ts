import {
  CONTROL_RULEBOOK_VERSION,
  mergeDualReleasePolicy,
} from "@pms/controls-engine";
import type { EncryptedBlob } from "./crypto";
import { encryptSecret } from "./crypto";
import { uuidv7 } from "./ids";
import type { Queryable } from "./migrate";
import {
  DEV_LOCATIONS,
  DEV_PASSWORD,
  DEV_RECOVERY_CODE,
  DEV_TENANTS,
  DEV_USERS,
  DEV_MFA_SECRET,
} from "./seed-data";
import { hashRecoveryCodes } from "./seed-recovery";
import { seedBankAccount } from "./seed-bank";
import { seedLedgerDemo } from "./seed-ledger";

export interface SeedOptions {
  password?: string;
  mfaSecret?: string;
  env?: Record<string, string | undefined>;
  now?: Date;
}

/**
 * Idempotent dev seed for two tenants. Safe to run twice; rows are upserted
 * by primary key. Requires an administrator connection (bypasses RLS).
 */
export async function seedDatabase(
  db: Queryable,
  opts: SeedOptions = {}
): Promise<{ tenants: number; users: number }> {
  const now = opts.now ?? new Date();
  const rawEnv = opts.env ?? process.env;
  const env =
    rawEnv.DEV_MFA_KEY || rawEnv.ENCRYPTION_KEY
      ? rawEnv
      : { ...rawEnv, DEV_MFA_KEY: "a".repeat(64) };
  const passwordHash = await hashPassword(opts.password ?? DEV_PASSWORD);
  const mfaSecret = opts.mfaSecret ?? DEV_MFA_SECRET;
  const mfaSecretEnc: EncryptedBlob = encryptSecret(mfaSecret, env);
  const pepper = env.DEV_MFA_KEY ?? env.ENCRYPTION_KEY ?? "";
  const recoveryHashes = JSON.stringify(
    hashRecoveryCodes([DEV_RECOVERY_CODE, "seed0-bbbb"], pepper)
  );

  for (const t of DEV_TENANTS) {
    await db.query(
      `INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug`,
      [t.id, t.name, t.slug, now]
    );
  }

  for (const loc of DEV_LOCATIONS) {
    await db.query(
      `INSERT INTO locations (id, tenant_id, name, timezone, active, created_at)
       VALUES ($1, $2, $3, $4, true, $5)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone`,
      [loc.id, loc.tenantId, loc.name, loc.timezone, now]
    );
  }

  for (const u of DEV_USERS) {
    const secretEnc = u.mfaEnrolled ? JSON.stringify(mfaSecretEnc) : null;
    const enrolledAt = u.mfaEnrolled ? now : null;
    const recovery = u.mfaEnrolled ? recoveryHashes : null;
    await db.query(
      `INSERT INTO users (
         id, tenant_id, username, display_name, password_hash, role, clinical_role,
         active, mfa_secret_enc, mfa_enrolled_at, recovery_codes_hash, password_changed_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8::jsonb, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         clinical_role = EXCLUDED.clinical_role,
         mfa_secret_enc = EXCLUDED.mfa_secret_enc,
         mfa_enrolled_at = EXCLUDED.mfa_enrolled_at,
         recovery_codes_hash = EXCLUDED.recovery_codes_hash,
         password_changed_at = EXCLUDED.password_changed_at`,
      [
        u.id,
        u.tenantId,
        u.username,
        u.displayName,
        passwordHash,
        u.role,
        u.clinicalRole,
        secretEnc,
        enrolledAt,
        recovery,
        now,
        now,
      ]
    );

    await db.query(
      `DELETE FROM user_entitlements WHERE user_id = $1 AND tenant_id = $2`,
      [u.id, u.tenantId]
    );
    for (const entitlement of u.entitlements) {
      await db.query(
        `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [u.tenantId, u.id, entitlement, now]
      );
    }
  }

  for (const t of DEV_TENANTS) {
    const owner = DEV_USERS.find((u) => u.tenantId === t.id && u.role === "admin");
    if (!owner) continue;
    const policy = mergeDualReleasePolicy({
      enabled: true,
      hardBlockWithoutSecond: false,
    });
    await db.query(
      `INSERT INTO control_policies (
         id, tenant_id, version, rulebook_version, policy, effective_from, created_at,
         created_by_id, created_by_name
       ) VALUES ($1, $2, 1, $3, $4::jsonb, $5, $5, $6, $7)
       ON CONFLICT (tenant_id, version) DO NOTHING`,
      [
        uuidv7(now.getTime()),
        t.id,
        CONTROL_RULEBOOK_VERSION,
        JSON.stringify(policy),
        now,
        owner.id,
        owner.displayName,
      ]
    );
  }

  await seedLedgerDemo(db, now);
  await seedBankAccount(db, now);

  return { tenants: DEV_TENANTS.length, users: DEV_USERS.length };
}

/** bcrypt hash compatible with apps/pms password.ts (cost from BCRYPT_COST). */
async function hashPassword(plain: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  const cost = Number(process.env.BCRYPT_COST);
  const rounds = cost > 0 ? cost : 12;
  return bcrypt.hash(plain, rounds);
}
