import { describe, expect, it } from "vitest";
import type { DualReleasePolicy } from "@pms/controls-engine";
import { CHANNEL_BY_KIND } from "@pms/ledger";
import { CHANNEL_FOR_REASON_KIND, effectiveThresholdCents, tightenPolicyForReason } from "./reasonThreshold";
import { REASON_KINDS, REASON_KIND_FOR_POSTING, type ReasonKind } from "./reasons";

const policy = {
  enabled: true,
  rules: [
    { channel: "writeoff", enabled: true, thresholdUsd: 150 },
    { channel: "check", enabled: true, thresholdUsd: 500 },
  ],
  exceptions: [],
} as unknown as DualReleasePolicy;

function thresholdOf(p: DualReleasePolicy, channel: string): number {
  return p.rules.find((r) => r.channel === channel)!.thresholdUsd;
}

describe("a reason's own threshold", () => {
  it("leaves the channel alone where the practice set no rule", () => {
    expect(effectiveThresholdCents(15_000, null)).toBe(15_000);
    // The same object comes back, so nothing downstream can mistake it for a change.
    expect(tightenPolicyForReason(policy, "writeoff", null)).toBe(policy);
  });

  it("tightens where the reason is stricter", () => {
    expect(effectiveThresholdCents(15_000, 5_000)).toBe(5_000);
    const tightened = tightenPolicyForReason(policy, "writeoff", 5_000);
    expect(thresholdOf(tightened, "writeoff")).toBe(50);
    // Only that channel moves; the others read as the policy says.
    expect(thresholdOf(tightened, "check")).toBe(500);
    // And the policy the practice holds is not mutated.
    expect(thresholdOf(policy, "writeoff")).toBe(150);
  });

  it("never loosens, which is the whole rule", () => {
    // A reason set above the channel would otherwise license what the channel holds.
    expect(effectiveThresholdCents(15_000, 90_000)).toBe(15_000);
    expect(tightenPolicyForReason(policy, "writeoff", 90_000)).toBe(policy);
    expect(thresholdOf(tightenPolicyForReason(policy, "writeoff", 90_000), "writeoff")).toBe(150);
  });

  it("holds every posting under a reason set to zero", () => {
    expect(effectiveThresholdCents(15_000, 0)).toBe(0);
    expect(thresholdOf(tightenPolicyForReason(policy, "writeoff", 0), "writeoff")).toBe(0);
  });

  it("leaves a policy that does not rule this channel exactly as it found it", () => {
    expect(tightenPolicyForReason(policy, "payroll", 100)).toBe(policy);
  });
});

describe("the channel a reason kind reaches", () => {
  it("states the composition of the two maps the product already holds", () => {
    // reasonThreshold.ts writes the composition out rather than computing it,
    // because computing it would pull the ledger package into the browser
    // bundle. This test computes it, so the two cannot drift apart in silence.
    const composed: Record<string, string | null> = Object.fromEntries(REASON_KINDS.map((k) => [k, null]));
    for (const [postingKind, reasonKind] of Object.entries(REASON_KIND_FOR_POSTING)) {
      const channel = CHANNEL_BY_KIND[postingKind as keyof typeof CHANNEL_BY_KIND] ?? null;
      const already = composed[reasonKind];
      // A reason kind drawn from two posting kinds must reach one channel, or
      // the figure shown beside a coverage row would be the wrong channel's.
      if (already !== null) expect(channel).toBe(already);
      composed[reasonKind] = channel;
    }
    expect(CHANNEL_FOR_REASON_KIND).toEqual(composed);
  });

  it("reaches no channel from a reason no posting form offers", () => {
    // `variance` belongs to bank reconciliation, so it holds no release channel.
    expect(CHANNEL_FOR_REASON_KIND.variance).toBeNull();
    expect(Object.keys(CHANNEL_FOR_REASON_KIND).sort()).toEqual([...REASON_KINDS].sort());
    for (const kind of REASON_KINDS) expect(CHANNEL_FOR_REASON_KIND[kind as ReasonKind]).toBeDefined();
  });
});
