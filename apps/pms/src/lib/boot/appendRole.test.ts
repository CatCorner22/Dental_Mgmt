import { describe, expect, it } from "vitest";
import { appendRoleErrors, readAppendRole } from "./appendRole";

describe("append role probe", () => {
  it("refuses a connection that does not hold app_append", () => {
    expect(appendRoleErrors({ role: "app_rw", admitted: false })).toEqual([
      "app_rw does not hold app_append",
    ]);
  });

  it("accepts app_append", async () => {
    const facts = await readAppendRole({
      async query() {
        return { rows: [{ role: "app_append", admitted: true }] };
      },
    });
    expect(facts).toEqual({ role: "app_append", admitted: true });
    expect(appendRoleErrors(facts)).toEqual([]);
  });
});
