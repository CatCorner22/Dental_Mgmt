import { describe, expect, it } from "vitest";
import { DISAMBIGUATION_CASES, runDisambiguationEval } from "./disambiguation-eval";
import {
  heuristicProposeReading,
  resolveReadingProposal,
  type ProposeReadingFn
} from "./readingProposer";

describe("reading proposer injection seam (charter §4.1)", () => {
  it("product default matches the heuristic", () => {
    const viaResolve = resolveReadingProposal(
      "CR",
      ["composite resin", "centric relation"],
      "Tooth 14 MOD CR placed after etch and bond."
    );
    const viaHeuristic = heuristicProposeReading(
      "CR",
      ["composite resin", "centric relation"],
      "Tooth 14 MOD CR placed after etch and bond."
    );
    expect(viaResolve?.suggested).toBe(viaHeuristic?.suggested);
  });

  it("frozen eval accepts an injected candidate without changing the product path", () => {
    const alwaysSilent: ProposeReadingFn = () => undefined;
    const report = runDisambiguationEval(DISAMBIGUATION_CASES, alwaysSilent);
    // Silence is correct only on null-expect cases — accuracy must drop.
    expect(report.accuracy).toBeLessThan(0.8);
    // Heuristic still clears the bar on the same frozen set.
    expect(runDisambiguationEval().accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
