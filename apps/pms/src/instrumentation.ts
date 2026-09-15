/**
 * Runs once when the Next.js Node server starts. Edge bundles must not import
 * database drivers; production env checks that need Postgres run on first use
 * in lib/db/client.ts instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerProductionBoot } = await import("./lib/boot/registerProduction");
  registerProductionBoot();
}
