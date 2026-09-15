import { describe, expect, it } from "vitest";
import { ridgeviewPractice } from "../fixtures/ridgeview";
import { DEFAULT_RISK_VARIABLES } from "./dynamic-variables";
import { portfolioSummary, scoreAllResidualRisks } from "./residual-engine";

describe("residual scoring", () => {
  it("does not increase average residual when dual control is added", () => {
    const off = ridgeviewPractice();
    off.staff.dualControlPayments = false;
    const on = ridgeviewPractice();
    on.staff.dualControlPayments = true;

    const offAvg = portfolioSummary(off).averageResidual;
    const onAvg = portfolioSummary(on).averageResidual;
    expect(onAvg).toBeLessThanOrEqual(offAvg);

    const viaVarsOff = portfolioSummary(off, {
      ...DEFAULT_RISK_VARIABLES,
      hasDualControl: false,
    });
    const viaVarsOn = portfolioSummary(off, {
      ...DEFAULT_RISK_VARIABLES,
      hasDualControl: true,
    });
    expect(viaVarsOn.averageResidual).toBeLessThanOrEqual(viaVarsOff.averageResidual);
  });

  it("does not increase average residual when independent bank rec is added", () => {
    const off = ridgeviewPractice();
    off.staff.independentBankRec = false;
    const on = ridgeviewPractice();
    on.staff.independentBankRec = true;

    expect(portfolioSummary(on).averageResidual).toBeLessThanOrEqual(
      portfolioSummary(off).averageResidual,
    );

    const viaVarsOff = portfolioSummary(off, {
      ...DEFAULT_RISK_VARIABLES,
      hasIndependentBankRec: false,
    });
    const viaVarsOn = portfolioSummary(off, {
      ...DEFAULT_RISK_VARIABLES,
      hasIndependentBankRec: true,
    });
    expect(viaVarsOn.averageResidual).toBeLessThanOrEqual(viaVarsOff.averageResidual);
  });

  it("gives a longer detection-lag scenario a residual at least as high as a shorter clone", () => {
    const short = ridgeviewPractice();
    const long = ridgeviewPractice();
    const template = short.scenarios.find((s) => s.id === "sc-cash-sod-failure");
    expect(template).toBeTruthy();
    const shortScenario = {
      ...template!,
      id: "sc-lag-short",
      title: "Short detection lag",
      baseTimelineDays: { p50: 30, p95Low: 14, p95High: 60 },
    };
    const longScenario = {
      ...template!,
      id: "sc-lag-long",
      title: "Long detection lag",
      baseTimelineDays: { p50: 210, p95Low: 120, p95High: 300 },
    };
    short.scenarios = [shortScenario];
    long.scenarios = [longScenario];

    const shortScore = scoreAllResidualRisks(short).find(
      (s) => s.linkedScenarioId === "sc-lag-short",
    );
    const longScore = scoreAllResidualRisks(long).find(
      (s) => s.linkedScenarioId === "sc-lag-long",
    );
    expect(shortScore).toBeTruthy();
    expect(longScore).toBeTruthy();
    expect(longScore!.residual).toBeGreaterThanOrEqual(shortScore!.residual);
    expect(longScore!.p50Days).toBeGreaterThan(shortScore!.p50Days!);
    expect(longScore!.drivers.some((d) => d.id.endsWith("-time") && d.direction === "increases")).toBe(
      true,
    );
  });

  it("stamps the bumped scoring version on every residual row", () => {
    const scores = scoreAllResidualRisks(ridgeviewPractice());
    expect(scores.length).toBeGreaterThan(0);
    for (const row of scores) {
      expect(row.scoringVersion).toBe("precog-residual-v1.1.0");
    }
  });
});
