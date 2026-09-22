import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app/", import.meta.url));

function lowestRank(route: string): string | undefined {
  const source = readFileSync(`${appDir}${route}`, "utf8");
  const ranks = [...source.matchAll(/minRank:\s*"([a-z]+)"/g)].map((m) => m[1]);
  const order = ["readonly", "user", "lead", "manager", "admin"];
  return ranks.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
}

/**
 * Two doors onto one thing (Increment 1.96).
 *
 * `GET /api/controls/policy` answers with the practice's control policy, the
 * dual-release thresholds among it. `GET /api/controls/risk` puts the same
 * material on a screen and has always needed `manager`. The policy route
 * stood at `user`, and nothing called it, so nobody read the gap — the
 * threshold a control enforces was one rank easier to reach than the screen
 * that shows it, which is the wrong way round for a figure somebody
 * structuring payments beneath it would want.
 *
 * Read from the files rather than asserted about them, for the reason the nav
 * gates are: a claim about a guard that does not read the guard goes stale in
 * silence.
 */
describe("the two routes that serve the control policy", () => {
  it("opens the plain read no wider than the screen that shows the same thing", () => {
    expect(lowestRank("api/controls/policy/route.ts")).toBe("manager");
    expect(lowestRank("api/controls/risk/route.ts")).toBe("manager");
  });
});
