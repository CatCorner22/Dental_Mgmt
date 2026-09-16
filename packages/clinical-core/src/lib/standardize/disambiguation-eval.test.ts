import { describe, expect, it } from "vitest";
import { DISAMBIGUATION_CASES, runDisambiguationEval } from "./disambiguation-eval";

describe("frozen disambiguation eval (charter §4.1)", () => {
  it("covers a fixed case count so the gate cannot shrink quietly", () => {
    expect(DISAMBIGUATION_CASES.length).toBeGreaterThanOrEqual(16);
  });

  it("deterministic heuristic clears the baseline bar", () => {
    const report = runDisambiguationEval();
    // Charter: encoder earns a slot only if it beats this. Heuristic must stay
    // useful — ratchet at 80% so quiet regressions fail CI.
    expect(report.accuracy, JSON.stringify(report.results.filter((r) => !r.pass))).toBeGreaterThanOrEqual(
      0.8
    );
  });

  it("prefers silence over a wrong guess on the ambiguous CR case", () => {
    const report = runDisambiguationEval();
    const row = report.results.find((r) => r.id === "cr.ambiguous");
    expect(row?.pass).toBe(true);
    expect(row?.suggested).toBeNull();
  });
});
