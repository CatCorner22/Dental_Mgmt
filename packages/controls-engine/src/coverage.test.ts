import { describe, expect, it } from "vitest";
import { mitigatedSodRuleIds } from "./controls/dual-release";
import {
  channelCoverage,
  dualControlPaymentsFromCoverage,
  isReleaseChannel,
  mitigatedRuleIdsForScoring,
  RELEASE_CHANNELS,
} from "./coverage";
import { AS_OF, ENFORCEMENT_INCREMENT_1_12, livePolicy } from "./fixtures/live-grants";

const ALL_ENFORCED = {
  ach: "enforced",
  check: "enforced",
  writeoff: "enforced",
  deposit: "enforced",
  vendor_new: "enforced",
  payroll: "enforced",
} as const;

describe("channelCoverage", () => {
  it("lists all six channels in rulebook order", () => {
    expect(RELEASE_CHANNELS).toEqual(["ach", "check", "writeoff", "vendor_new", "deposit", "payroll"]);
    const rows = channelCoverage(livePolicy(), ENFORCEMENT_INCREMENT_1_12, AS_OF);
    expect(rows.map((r) => r.channel)).toEqual(RELEASE_CHANNELS);
    expect(isReleaseChannel("payroll")).toBe(true);
    expect(isReleaseChannel("wire")).toBe(false);
  });

  it("never lets an external channel count toward scores, even when the policy enables it", () => {
    const rows = channelCoverage(livePolicy(), ENFORCEMENT_INCREMENT_1_12, AS_OF);
    const payroll = rows.find((r) => r.channel === "payroll")!;
    expect(payroll.policyEnabled).toBe(true);
    expect(payroll.status).toBe("external");
    expect(payroll.countsTowardScores).toBe(false);
    const writeoff = rows.find((r) => r.channel === "writeoff")!;
    expect(writeoff.status).toBe("enforced");
    expect(writeoff.countsTowardScores).toBe(true);
  });

  it("never lets a partial channel count: patient refunds do not mitigate vendor fraud", () => {
    const rows = channelCoverage(livePolicy(), ENFORCEMENT_INCREMENT_1_12, AS_OF);
    for (const channel of ["ach", "check"] as const) {
      const row = rows.find((r) => r.channel === channel)!;
      expect(row.policyEnabled).toBe(true);
      expect(row.status).toBe("partial");
      expect(row.countsTowardScores).toBe(false);
      expect(row.note).toMatch(/mitigates no SoD rule/);
    }
  });

  it("shows an enforced channel as off when the policy or rule is disabled", () => {
    const off = channelCoverage(livePolicy({ enabled: false }), ENFORCEMENT_INCREMENT_1_12, AS_OF);
    expect(off.find((r) => r.channel === "writeoff")!.status).toBe("off");
    expect(off.find((r) => r.channel === "ach")!.status).toBe("partial");
    expect(off.every((r) => !r.countsTowardScores)).toBe(true);
    const ruleOff = channelCoverage(
      livePolicy({ rules: [{ channel: "writeoff", enabled: false } as never] }),
      ALL_ENFORCED,
      AS_OF,
    );
    expect(ruleOff.find((r) => r.channel === "writeoff")!.status).toBe("off");
    expect(ruleOff.find((r) => r.channel === "ach")!.status).toBe("enforced");
  });

  it("excludes rules that only a partial or external channel would mitigate", () => {
    const policy = livePolicy();
    const everything = mitigatedSodRuleIds(policy);
    const scoring = mitigatedRuleIdsForScoring(policy, ENFORCEMENT_INCREMENT_1_12, AS_OF);
    expect(everything.has("rule-payroll")).toBe(true);
    expect(everything.has("rule-vendor-create-pay")).toBe(true);
    expect(scoring.has("rule-payroll")).toBe(false); // payroll external
    expect(scoring.has("rule-cash-rec")).toBe(false); // deposit external
    expect(scoring.has("rule-vendor-create-pay")).toBe(false); // ACH and check partial
    expect(scoring.has("rule-vendor-approve-pay")).toBe(false);
    expect(Array.from(scoring).sort()).toEqual(["rule-claims-writeoff", "rule-writeoff"]);
    expect(Array.from(scoring).every((id) => everything.has(id))).toBe(true);
    expect(Array.from(mitigatedRuleIdsForScoring(policy, ALL_ENFORCED, AS_OF)).sort()).toEqual(
      Array.from(everything).sort(),
    );
  });

  it("counts active exceptions per channel by date window", () => {
    const policy = livePolicy({
      exceptions: [
        {
          id: "ex-1",
          label: "Lab raise",
          channels: ["ach"],
          action: "raise_threshold",
          thresholdUsd: 3500,
          enabled: true,
          reason: "Recurring lab.",
          createdAt: AS_OF,
          effectiveFrom: "2026-09-01",
          effectiveTo: "2026-09-30",
        },
        {
          id: "ex-2",
          label: "Expired",
          channels: ["ach"],
          action: "raise_threshold",
          thresholdUsd: 3500,
          enabled: true,
          reason: "Old.",
          createdAt: AS_OF,
          effectiveTo: "2026-08-31",
        },
        {
          id: "ex-3",
          label: "All channels, disabled",
          channels: [],
          action: "force_dual",
          enabled: false,
          reason: "Off.",
          createdAt: AS_OF,
        },
      ],
    });
    const rows = channelCoverage(policy, ENFORCEMENT_INCREMENT_1_12, AS_OF);
    expect(rows.find((r) => r.channel === "ach")!.activeExceptions).toBe(1);
    expect(rows.find((r) => r.channel === "check")!.activeExceptions).toBe(0);
  });

  it("derives dual control on payments from a counted ACH or deposit channel only", () => {
    expect(dualControlPaymentsFromCoverage(channelCoverage(livePolicy(), ENFORCEMENT_INCREMENT_1_12, AS_OF))).toBe(
      false,
    );
    const achEnforced = { ...ENFORCEMENT_INCREMENT_1_12, ach: "enforced" as const };
    expect(dualControlPaymentsFromCoverage(channelCoverage(livePolicy(), achEnforced, AS_OF))).toBe(true);
    const depositRecorded = { ...ENFORCEMENT_INCREMENT_1_12, deposit: "recorded" as const };
    expect(dualControlPaymentsFromCoverage(channelCoverage(livePolicy(), depositRecorded, AS_OF))).toBe(true);
    expect(
      dualControlPaymentsFromCoverage(channelCoverage(livePolicy({ enabled: false }), achEnforced, AS_OF)),
    ).toBe(false);
  });
});
