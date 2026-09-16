import { assertProductionBoot } from "./guards";

/** Node-only production boot checks that do not touch the database. */
export function registerProductionBoot(env: Record<string, string | undefined> = process.env): void {
  assertProductionBoot(env);
}
