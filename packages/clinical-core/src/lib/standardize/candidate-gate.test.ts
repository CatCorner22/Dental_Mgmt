import { describe, expect, it } from "vitest";
import { gateEncoderCandidate, GATE_FLOOR } from "./candidate-gate";
import { DISAMBIGUATION_CASES } from "./disambiguation-eval";
import { heuristicProposeReading, type ProposeReadingFn } from "./readingProposer";

describe("encoder candidate gate (charter §4.1)", () => {
  it("refuses a candidate that stays silent everywhere", () => {
    const silent: ProposeReadingFn = () => undefined;
    const report = gateEncoderCandidate(silent);
    expect(report.pass).toBe(false);
    expect(report.beatsBaseline).toBe(false);
  });

  it("refuses an exact copy of the heuristic — a tie is not a win", () => {
    const report = gateEncoderCandidate(heuristicProposeReading);
    expect(report.candidateAccuracy).toBe(report.baselineAccuracy);
    expect(report.pass).toBe(false);
    expect(report.verdict).toMatch(/REFUSED/);
  });

  it("passes only a candidate strictly better than the heuristic AND above the floor", () => {
    // An oracle candidate: answers every frozen case correctly. This is what
    // a real encoder must approach to take the slot.
    const oracle: ProposeReadingFn = (display, alternatives, text) => {
      const gold = DISAMBIGUATION_CASES.find((c) => c.display === display && c.text === text);
      if (!gold || gold.expectSuggested === null) return undefined;
      const match = alternatives.find((a) => new RegExp(gold.expectSuggested!, "i").test(a));
      return match
        ? { suggested: match, rationale: "oracle", strength: 1 }
        : undefined;
    };
    const report = gateEncoderCandidate(oracle);
    expect(report.candidateAccuracy).toBe(1);
    // Passes only if the heuristic is not already perfect; either way the
    // relationship holds: pass === strictly-better && above-floor.
    expect(report.pass).toBe(report.beatsBaseline && report.candidateAccuracy >= GATE_FLOOR);
    if (report.baselineAccuracy < 1) {
      expect(report.pass).toBe(true);
      expect(report.verdict).toMatch(/still requires charter review/);
    }
  });

  it("names the failing case ids so a passing candidate can still be reviewed", () => {
    const silent: ProposeReadingFn = () => undefined;
    const report = gateEncoderCandidate(silent);
    // Silence fails exactly the non-null cases.
    const nonNull = DISAMBIGUATION_CASES.filter((c) => c.expectSuggested !== null).length;
    expect(report.candidateFailures).toHaveLength(nonNull);
  });
});
