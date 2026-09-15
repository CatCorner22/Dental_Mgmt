import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NAMED_TABLES, RLS_STEPS } from "./contract";
import { applicationWhereCanLeak, rlsWouldIsolate, verifyRlsSql } from "./rls";

const sqlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../db/migrations/0001_init.sql"
);

describe("RLS verifier", () => {
  it("accepts the Increment 0.1 migration", () => {
    const sql = readFileSync(sqlPath, "utf8");
    const verdict = verifyRlsSql(sql);
    expect(verdict.objections).toEqual([]);
    expect(verdict.publish).toBe(true);
    expect(verdict.stepsChecked).toBe(RLS_STEPS.length);
    expect(NAMED_TABLES.length).toBeGreaterThan(3);
  });

  it("fails when ENABLE RLS is missing", () => {
    const verdict = verifyRlsSql("CREATE TABLE users (id uuid);");
    expect(verdict.publish).toBe(false);
    expect(verdict.objections.some((o) => o.stepId === "rls-enabled")).toBe(true);
  });

  it("a missing WHERE leaks without RLS and does not leak with it", () => {
    const rows = [
      { id: "1", tenantId: "aaaa" },
      { id: "2", tenantId: "bbbb" },
    ];
    const leaked = applicationWhereCanLeak(rows, true);
    expect(leaked).toHaveLength(2);
    expect(rlsWouldIsolate(leaked, "aaaa", false)).toHaveLength(2);
    expect(rlsWouldIsolate(leaked, "aaaa", true).map((r) => r.id)).toEqual(["1"]);
  });
});
