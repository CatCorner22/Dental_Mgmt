import { describe, expect, it } from "vitest";
import { ridgeviewPractice } from "../../fixtures/ridgeview";
import { DEFAULT_RISK_VARIABLES } from "../../scoring/dynamic-variables";
import { runCounterfactuals } from "./counterfactual";

describe("runCounterfactuals", () => {
  it("lowers residual in the enable_dual_control twin when dual starts off", () => {
    const state = ridgeviewPractice();
    state.staff.dualControlPayments = false;
    const result = runCounterfactuals(
      state,
      { ...DEFAULT_RISK_VARIABLES, hasDualControl: false },
      ["enable_dual_control"],
    );
    const twin = result.counterfactuals.find((c) => c.leverId === "enable_dual_control");
    expect(twin).toBeTruthy();
    expect(twin!.world.residual).toBeLessThan(result.factual.residual);
    expect(twin!.delta.residual).toBeLessThan(0);
  });
});
