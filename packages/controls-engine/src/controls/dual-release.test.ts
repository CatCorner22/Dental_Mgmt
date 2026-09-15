import { describe, expect, it } from "vitest";
import { ridgeviewPractice } from "../fixtures/ridgeview";
import {
  defaultDualReleasePolicy,
  evaluateRelease,
  mergeDualReleasePolicy,
  type DualReleasePolicy,
  type ReleaseEvaluation,
  type ThresholdException,
} from "./dual-release";

function enabledPolicy(exceptions: ThresholdException[] = []): DualReleasePolicy {
  return mergeDualReleasePolicy({
    enabled: true,
    hardBlockWithoutSecond: true,
    exceptions,
  });
}

function collectNumbers(value: unknown, acc: number[] = []): number[] {
  if (typeof value === "number") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectNumbers(item, acc);
  }
  return acc;
}

function expectFiniteMoney(evaluation: ReleaseEvaluation) {
  expect(Number.isFinite(evaluation.thresholdUsd)).toBe(true);
  expect(Number.isFinite(evaluation.baseThresholdUsd)).toBe(true);
  expect(Number.isFinite(evaluation.amountUsd)).toBe(true);
  if (evaluation.appliedException) {
    expect(Number.isFinite(evaluation.appliedException.baseThresholdUsd)).toBe(true);
    expect(Number.isFinite(evaluation.appliedException.effectiveThresholdUsd)).toBe(true);
  }
  for (const n of collectNumbers(evaluation)) {
    expect(Number.isFinite(n)).toBe(true);
  }
}

describe("evaluateRelease", () => {
  const people = ridgeviewPractice().people;
  const om = "p2";
  const owner = "p1";

  it("allows a single release at or below the ACH threshold", () => {
    const evaluation = evaluateRelease(
      enabledPolicy(),
      { channel: "ach", amountUsd: 500, initiatorPersonId: om },
      people,
    );
    expect(evaluation.status).toBe("below_threshold");
    expect(evaluation.ok).toBe(true);
    expect(evaluation.dualRequired).toBe(false);
    expect(evaluation.thresholdUsd).toBe(500);
    expectFiniteMoney(evaluation);
  });

  it("requires a second signer above the ACH threshold", () => {
    const evaluation = evaluateRelease(
      enabledPolicy(),
      { channel: "ach", amountUsd: 501, initiatorPersonId: om },
      people,
    );
    expect(evaluation.status).toBe("blocked_missing_second");
    expect(evaluation.ok).toBe(false);
    expect(evaluation.dualRequired).toBe(true);
    expect(evaluation.thresholdUsd).toBe(500);
    expectFiniteMoney(evaluation);
  });

  it("blocks the same person as first and second signer", () => {
    const evaluation = evaluateRelease(
      enabledPolicy(),
      {
        channel: "ach",
        amountUsd: 1200,
        initiatorPersonId: om,
        secondPersonId: om,
      },
      people,
    );
    expect(evaluation.status).toBe("blocked_same_person");
    expect(evaluation.ok).toBe(false);
    expectFiniteMoney(evaluation);
  });

  it("approves waive_dual without Infinity in any numeric field", () => {
    const evaluation = evaluateRelease(
      enabledPolicy([
        {
          id: "ex-waive",
          label: "Waive ACH dual",
          channels: ["ach"],
          action: "waive_dual",
          enabled: true,
          reason: "Owner residual acceptance for this payee.",
          createdAt: "2026-01-01",
          residualNote: "Documented residual — re-review in 30 days.",
        },
      ]),
      { channel: "ach", amountUsd: 9000, initiatorPersonId: om, payee: "lab" },
      people,
    );
    expect(evaluation.status).toBe("approved_exception");
    expect(evaluation.ok).toBe(true);
    expect(evaluation.dualRequired).toBe(false);
    expect(evaluation.thresholdUsd).toBe(500);
    expect(evaluation.appliedException?.effectiveThresholdUsd).toBe(500);
    expectFiniteMoney(evaluation);
    expect(JSON.stringify(evaluation)).not.toContain("Infinity");
  });

  it("force_dual requires a second signer even under the base threshold", () => {
    const evaluation = evaluateRelease(
      enabledPolicy([
        {
          id: "ex-force",
          label: "Force dual on small ACH",
          channels: ["ach"],
          action: "force_dual",
          enabled: true,
          reason: "First payment to a new payee.",
          createdAt: "2026-01-01",
        },
      ]),
      { channel: "ach", amountUsd: 100, initiatorPersonId: om },
      people,
    );
    expect(evaluation.dualRequired).toBe(true);
    expect(evaluation.status).toBe("blocked_missing_second");
    expect(evaluation.ok).toBe(false);
    expect(evaluation.thresholdUsd).toBe(500);
    expectFiniteMoney(evaluation);
  });

  it("approves dual when owner seconds an above-threshold ACH", () => {
    const evaluation = evaluateRelease(
      enabledPolicy(),
      {
        channel: "ach",
        amountUsd: 1200,
        initiatorPersonId: om,
        secondPersonId: owner,
      },
      people,
    );
    expect(evaluation.status).toBe("approved_dual");
    expect(evaluation.ok).toBe(true);
    expectFiniteMoney(evaluation);
  });

  it("stays off when the practice has not enabled dual release", () => {
    const evaluation = evaluateRelease(
      defaultDualReleasePolicy({
        ...ridgeviewPractice().staff,
        dualControlPayments: false,
      }),
      { channel: "ach", amountUsd: 100, initiatorPersonId: om },
      people,
    );
    expect(evaluation.status).toBe("blocked_policy_off");
    expectFiniteMoney(evaluation);
  });
});
