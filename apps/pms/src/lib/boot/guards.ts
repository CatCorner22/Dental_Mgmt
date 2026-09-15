/**
 * Production boot gates. Increment 0.1 local/dev may start without a vault.
 * Production refuses to start without the listed controls.
 */
export function productionBootErrors(
  env: Record<string, string | undefined> = process.env
): string[] {
  if (env.NODE_ENV !== "production") return [];
  const missing: string[] = [];
  const url = env.POSTGRES_URL ?? "";
  if (!url) missing.push("POSTGRES_URL");
  if (url && !/sslmode=verify-full/i.test(url) && env.ALLOW_INSECURE_DB !== "1") {
    missing.push("POSTGRES_URL must use sslmode=verify-full");
  }
  if (!env.KMS_KEY_ID && !env.DEV_MFA_KEY && !env.ENCRYPTION_KEY) {
    missing.push("KMS_KEY_ID (or DEV_MFA_KEY in a documented exception)");
  }
  if (!env.BACKUP_TARGET) missing.push("BACKUP_TARGET");
  if (!env.OBJECT_STORAGE_URL) missing.push("OBJECT_STORAGE_URL");
  if (!env.APPEND_ROLE_DSN) missing.push("APPEND_ROLE_DSN");
  if (env.AUTH_DEV_MEMORY === "1") missing.push("AUTH_DEV_MEMORY is forbidden in production");
  return missing;
}

export function assertProductionBoot(env: Record<string, string | undefined> = process.env): void {
  const errors = productionBootErrors(env);
  if (errors.length) {
    throw new Error(`Production refused to boot: ${errors.join("; ")}`);
  }
}
