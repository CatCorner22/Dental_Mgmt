import { describe, expect, it } from "vitest";
import { runUnparsedRoutingEval, UNPARSED_ROUTING_CASES } from "./unparsed-routing-eval";

describe("frozen unread-clause routing eval (charter §4.2)", () => {
  it("covers a fixed case count", () => {
    expect(UNPARSED_ROUTING_CASES.length).toBeGreaterThanOrEqual(12);
  });

  it("heuristic clears the baseline bar", () => {
    const report = runUnparsedRoutingEval();
    expect(report.accuracy, JSON.stringify(report.misses)).toBeGreaterThanOrEqual(0.9);
  });
});
