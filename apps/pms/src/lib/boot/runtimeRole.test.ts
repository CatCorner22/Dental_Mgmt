import { describe, expect, it } from "vitest";
import { RUNTIME_ROLE_SQL, readRuntimeRole, runtimeRoleErrors } from "./runtimeRole";

describe("runtime role guard", () => {
  it("accepts an ordinary role that owns nothing", () => {
    expect(
      runtimeRoleErrors({ role: "app_rw", superuser: false, bypassRls: false, ownedTables: [] })
    ).toEqual([]);
  });

  it("refuses superuser, BYPASSRLS, and table ownership", () => {
    const errors = runtimeRoleErrors({
      role: "postgres",
      superuser: true,
      bypassRls: true,
      ownedTables: ["users", "sessions"],
    });
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/superuser/);
    expect(errors[1]).toMatch(/BYPASSRLS/);
    expect(errors[2]).toMatch(/owns 2 table/);
  });

  it("asks the live connection about current_user only", async () => {
    expect(RUNTIME_ROLE_SQL).toMatch(/WHERE r\.rolname = current_user/);
    const facts = await readRuntimeRole({
      query: async () => ({
        rows: [{ role: "app_rw", superuser: false, bypass_rls: false, owned_tables: [] }],
      }),
    });
    expect(facts).toEqual({ role: "app_rw", superuser: false, bypassRls: false, ownedTables: [] });
  });
});
