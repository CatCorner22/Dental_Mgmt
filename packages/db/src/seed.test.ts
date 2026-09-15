import { describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl } from "./testing/liveDatabase";
import { seedDatabase } from "./seed";
import { DEV_USERS } from "./seed-data";

const adminUrl = liveAdminUrl();

describe.skipIf(!adminUrl)("seedDatabase", () => {
  it("is idempotent and leaves one unenrolled user", async () => {
    const db = await createLiveDatabase(adminUrl!);
    try {
      const env = { DEV_MFA_KEY: "a".repeat(64), BCRYPT_COST: "4" };
      const first = await seedDatabase(db.admin, { env });
      const second = await seedDatabase(db.admin, { env });
      expect(first.users).toBe(DEV_USERS.length);
      expect(second.users).toBe(DEV_USERS.length);

      const { rows } = await db.admin.query(
        "SELECT username, mfa_enrolled_at IS NOT NULL AS enrolled FROM users ORDER BY username"
      );
      expect(rows.find((r) => r.username === "ridgeview-newhire")).toEqual({
        username: "ridgeview-newhire",
        enrolled: false,
      });
      expect(rows.find((r) => r.username === "ridgeview-owner")?.enrolled).toBe(true);
    } finally {
      await db.destroy();
    }
  }, 60_000);
});
