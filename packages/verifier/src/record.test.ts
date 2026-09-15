import { describe, expect, it } from "vitest";
import { expectedHash } from "./chain";
import { recordDatabaseChains } from "./record";

const GENESIS = "0".repeat(64);

describe("recordDatabaseChains", () => {
  it("refuses to record when verification is not admitted", async () => {
    const verdict = await recordDatabaseChains(
      {
        async query() {
          return {
            rows: [{ role: "app_rw", admitted: false }],
          };
        },
      },
      { async query() { return { rows: [] }; } },
      "2026-09-15"
    );
    expect(verdict.recorded).toEqual([]);
    expect(verdict.objections[0]?.stepId).toBe("verifier-admitted");
  });

  it("writes one row per tenant as app_append", async () => {
    const inserts: unknown[][] = [];
    const at = "2026-09-15T00:00:00.000Z";
    const hash = expectedHash({
      tenantId: "t1",
      prevHash: GENESIS,
      kind: "auth.signin",
      payload: {},
      occurredAt: at,
    });
    const verdict = await recordDatabaseChains(
      {
        async query(sql: string) {
          if (sql.includes("pg_has_role")) {
            return { rows: [{ role: "app_verify", admitted: true }] };
          }
          if (sql.includes("FROM domain_event")) {
            return {
              rows: [
                {
                  tenant_id: "t1",
                  kind: "auth.signin",
                  payload: {},
                  prev_hash: GENESIS,
                  hash,
                  occurred_at: at,
                  seq: 1,
                },
              ],
            };
          }
          return { rows: [] };
        },
      },
      {
        async query(sql: string, params?: unknown[]) {
          if (sql.includes("pg_has_role")) {
            return { rows: [{ role: "app_append", admitted: true }] };
          }
          if (sql.includes("INSERT INTO audit_chain_checks")) {
            inserts.push(params ?? []);
            return { rows: [{ tenant_id: "t1" }] };
          }
          return { rows: [] };
        },
      },
      "2026-09-15"
    );
    expect(verdict.publish).toBe(true);
    expect(verdict.recorded).toHaveLength(1);
    expect(verdict.recorded[0]).toMatchObject({
      tenantId: "t1",
      ok: true,
      headHash: hash,
      eventCount: 1,
      inserted: true,
    });
    expect(inserts[0]).toEqual(["t1", "2026-09-15", true, hash, 1]);
  });
});
