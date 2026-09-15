import { describe, expect, it } from "vitest";
import { CHAIN_STEPS, LIMITS } from "./contract";
import { expectedHash, verifyChain, type ChainEvent } from "./chain";

function ev(partial: Partial<ChainEvent> & Pick<ChainEvent, "kind" | "occurredAt">): ChainEvent {
  const prevHash = partial.prevHash ?? "0".repeat(64);
  const base = {
    prevHash,
    tenantId: partial.tenantId ?? "t1",
    kind: partial.kind,
    payload: partial.payload ?? { n: 1 },
    occurredAt: partial.occurredAt,
  };
  return { ...base, hash: partial.hash ?? expectedHash(base) };
}

describe("event chain verifier", () => {
  it("checks every restated step", () => {
    const a = ev({ kind: "user.created", occurredAt: "2026-09-14T00:00:00.000Z" });
    const b = ev({
      kind: "session.started",
      occurredAt: "2026-09-14T00:01:00.000Z",
      prevHash: a.hash,
    });
    const verdict = verifyChain([a, b]);
    expect(verdict.publish).toBe(true);
    expect(verdict.stepsChecked).toBe(CHAIN_STEPS.length);
    expect(verdict.stepsExpected).toBe(CHAIN_STEPS.length);
    expect(LIMITS.length).toBeGreaterThan(0);
  });

  it("refuses a planted tamper", () => {
    const a = ev({ kind: "user.created", occurredAt: "2026-09-14T00:00:00.000Z" });
    const b = ev({
      kind: "session.started",
      occurredAt: "2026-09-14T00:01:00.000Z",
      prevHash: a.hash,
    });
    const tampered = { ...b, payload: { n: 99 }, hash: b.hash };
    const verdict = verifyChain([a, tampered]);
    expect(verdict.publish).toBe(false);
    expect(verdict.objections.some((o) => o.stepId === "hash-agrees")).toBe(true);
  });

  it("refuses a broken link", () => {
    const a = ev({ kind: "user.created", occurredAt: "2026-09-14T00:00:00.000Z" });
    const b = ev({
      kind: "session.started",
      occurredAt: "2026-09-14T00:01:00.000Z",
      prevHash: "f".repeat(64),
    });
    const verdict = verifyChain([a, b]);
    expect(verdict.publish).toBe(false);
    expect(verdict.objections.some((o) => o.stepId === "links-hold")).toBe(true);
  });
});
