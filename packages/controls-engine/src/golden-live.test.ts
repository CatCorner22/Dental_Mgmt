import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { channelCoverage } from "./coverage";
import {
  AS_OF,
  ENFORCEMENT_INCREMENT_1_12,
  liveDecisions,
  liveGrants,
  livePeople,
  livePolicy,
  TAKEN_AT,
} from "./fixtures/live-grants";
import { evaluateGrant } from "./grants";
import { buildPracticeState } from "./practice-state-builder";
import { takeControlSnapshot } from "./snapshot";

/**
 * Golden hashes for the live-grant path (Increment 1.12). Regenerate only
 * with a deliberate scoring or rulebook change, alongside a version bump:
 *   UPDATE_GOLDEN_LIVE=1 pnpm --filter @pms/controls-engine test
 */
const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "fixtures/golden-live-hashes.json");

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("live-grant golden snapshots", () => {
  const built = buildPracticeState({
    people: livePeople,
    grants: liveGrants,
    policy: livePolicy(),
    decisions: liveDecisions,
    enforcement: ENFORCEMENT_INCREMENT_1_12,
    asOf: AS_OF,
  });
  const actual = {
    buildPracticeState: stableHash(built),
    channelCoverage: stableHash(channelCoverage(livePolicy(), ENFORCEMENT_INCREMENT_1_12, AS_OF)),
    evaluateGrant: stableHash(
      evaluateGrant(
        built.state,
        built.assignments,
        { personId: "u-om", personName: "Maya Chen", role: "Office Manager", entitlement: "bank_reconcile" },
        built.detectOptions,
      ),
    ),
    takeControlSnapshot: stableHash(
      takeControlSnapshot({
        state: built.state,
        sod: built.sod,
        coverage: built.coverage,
        decisions: liveDecisions,
        takenAt: TAKEN_AT,
      }),
    ),
  };

  it("reproduces byte-identical outputs for the frozen live-grant fixture", () => {
    if (process.env.UPDATE_GOLDEN_LIVE === "1") {
      writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    }
    const expected = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
    expect(actual).toEqual(expected);
  });
});
