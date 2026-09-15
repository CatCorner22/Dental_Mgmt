import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assessCoso } from "./coso";
import { evaluateRelease, defaultDualReleasePolicy } from "./controls/dual-release";
import { findKnowledgeRisks, runPrecogScenario } from "./engine";
import { ridgeviewPractice } from "./fixtures/ridgeview";
import { beamSearchLevers } from "./llm/reasoning/beam-search";
import { runCounterfactuals } from "./llm/reasoning/counterfactual";
import { portfolioSummary, scoreAllResidualRisks } from "./scoring/residual-engine";
import { detectSodConflicts } from "./sod/detect";
import { scoreLeadingIndicators } from "./signals/leading-indicators";

const here = dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(
  readFileSync(join(here, "fixtures/golden-hashes.json"), "utf8")
) as Record<string, string>;

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("ridgeview golden snapshots", () => {
  const state = ridgeviewPractice();

  it("reproduces byte-identical scoring outputs for the frozen fixture", () => {
    const actual = {
      findKnowledgeRisks: stableHash(findKnowledgeRisks(state)),
      runPrecogScenario: stableHash(runPrecogScenario(state, "sc-cash-sod-failure")),
      assessCoso: stableHash(assessCoso(state)),
      portfolioSummary: stableHash(portfolioSummary(state)),
      scoreAllResidualRisks: stableHash(scoreAllResidualRisks(state)),
      scoreLeadingIndicators: stableHash(scoreLeadingIndicators(state)),
      detectSodConflicts: stableHash(detectSodConflicts(state)),
      evaluateRelease: stableHash(
        evaluateRelease(
          defaultDualReleasePolicy(),
          { channel: "ach", amountUsd: 501, initiatorPersonId: "p2" },
          state.people
        )
      ),
      runCounterfactuals: stableHash(runCounterfactuals(state, "sc-cash-sod-failure")),
      beamSearchLevers: stableHash(beamSearchLevers(state, "sc-cash-sod-failure")),
    };
    expect(actual).toEqual(expected);
  });

  it("is deterministic across two invocations", () => {
    const once = stableHash(portfolioSummary(state));
    const twice = stableHash(portfolioSummary(ridgeviewPractice()));
    expect(once).toBe(twice);
  });
});
