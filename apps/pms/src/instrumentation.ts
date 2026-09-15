/**
 * Runs once when the Next.js server starts. Production refuses to boot
 * without the listed controls and refuses a database connection that could
 * bypass row-level security. Development and tests are untouched.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionBoot } = await import("./lib/boot/guards");
  assertProductionBoot();

  if (process.env.NODE_ENV !== "production" || process.env.AUTH_DEV_MEMORY === "1") return;
  const { getPool } = await import("./lib/db/client");
  const { assertRuntimeRole } = await import("./lib/boot/runtimeRole");
  const facts = await assertRuntimeRole(getPool());
  console.log(`[boot] database role ${facts.role}: not superuser, not BYPASSRLS, owns no tables`);
}
