import { describe, expect, it } from "vitest";
import { expectedHash } from "./chain";
import { CHAIN_QUERY, groupByTenant, verifyDatabaseChains } from "./database";

const GENESIS = "0".repeat(64);

function row(
  tenantId: string,
  seq: number,
  prevHash: string,
  kind: string,
  payload: object,
  at: Date
) {
  const hash = expectedHash({ tenantId, prevHash, kind, payload, occurredAt: at.toISOString() });
  // seq comes back from pg as a bigint string.
  return { tenant_id: tenantId, kind, payload, prev_hash: prevHash, hash, occurred_at: at, seq: String(seq) };
}

describe("database chain verifier", () => {
  const t1a = row("t1", 1, GENESIS, "auth.signin", { s: 1 }, new Date("2026-09-15T00:00:00Z"));
  const t1b = row("t1", 2, t1a.hash, "auth.signin", { s: 2 }, new Date("2026-09-15T00:01:00Z"));
  const t2a = row("t2", 1, GENESIS, "auth.signin", { s: 3 }, new Date("2026-09-15T00:00:30Z"));

  it("reads only domain_event, in per-tenant seq order", () => {
    expect(CHAIN_QUERY).toMatch(/FROM domain_event/);
    expect(CHAIN_QUERY).not.toMatch(/JOIN|users|sessions|phi_access_log/);
    expect(CHAIN_QUERY).toMatch(/ORDER BY tenant_id, seq/);
  });

  it("refuses a gap in the sequence", async () => {
    const t1c = row("t1", 4, t1b.hash, "auth.signin", { s: 4 }, new Date("2026-09-15T00:02:00Z"));
    const verdict = await verifyDatabaseChains({ query: async () => ({ rows: [t1a, t1b, t1c] }) });
    expect(verdict.publish).toBe(false);
    expect(verdict.tenants[0].objections.map((o) => o.stepId)).toEqual(["sequence-dense"]);
  });

  it("verifies each tenant separately and passes an intact database", async () => {
    const verdict = await verifyDatabaseChains({ query: async () => ({ rows: [t1a, t1b, t2a] }) });
    expect(verdict.publish).toBe(true);
    expect(verdict.events).toBe(3);
    expect(verdict.tenants.map((t) => [t.tenantId, t.events, t.publish])).toEqual([
      ["t1", 2, true],
      ["t2", 1, true],
    ]);
  });

  it("names the tenant whose row was rewritten", async () => {
    const tampered = { ...t1b, payload: { s: 99 } };
    const verdict = await verifyDatabaseChains({
      query: async () => ({ rows: [t1a, tampered, t2a] }),
    });
    expect(verdict.publish).toBe(false);
    const t1 = verdict.tenants.find((t) => t.tenantId === "t1")!;
    expect(t1.publish).toBe(false);
    expect(t1.objections.map((o) => o.stepId)).toContain("hash-agrees");
    expect(verdict.tenants.find((t) => t.tenantId === "t2")!.publish).toBe(true);
  });

  it("normalises timestamps to the ISO string the writer hashed", () => {
    const chains = groupByTenant([{ ...t1a, occurred_at: "2026-09-15T00:00:00.000Z" }]);
    expect(chains.get("t1")![0]).toMatchObject({ occurredAt: "2026-09-15T00:00:00.000Z", seq: 1 });
  });

  it("passes an empty database", async () => {
    const verdict = await verifyDatabaseChains({ query: async () => ({ rows: [] }) });
    expect(verdict).toMatchObject({ publish: true, events: 0, tenants: [] });
  });
});
