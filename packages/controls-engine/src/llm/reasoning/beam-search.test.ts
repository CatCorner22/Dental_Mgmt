import { describe, expect, it } from "vitest";
import { ridgeviewPractice } from "../../fixtures/ridgeview";
import { DEFAULT_RISK_VARIABLES } from "../../scoring/dynamic-variables";
import { beamSearchLevers } from "./beam-search";

describe("beamSearchLevers", () => {
  it("keeps the empty status-quo sequence in the final ranking", () => {
    const state = ridgeviewPractice();
    const result = beamSearchLevers(state, {
      ...DEFAULT_RISK_VARIABLES,
      hasDualControl: false,
      hasIndependentBankRec: false,
    }, { beamWidth: 3, depth: 2 });

    const empty = result.topBeams.find((b) => b.sequence.length === 0);
    expect(empty).toBeTruthy();
    expect(empty!.labels).toEqual([]);
    expect(result.frontier.some((f) => f.sequence === "(none)" || /status quo/i.test(f.sequence))).toBe(
      true,
    );
    if (result.best.utility === empty!.utility) {
      expect(result.best.sequence).toEqual([]);
    }
  });
});
