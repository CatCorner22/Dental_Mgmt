import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CPA_SURFACES, freeTextSurfaces } from "./cpaSurfaces";

const appDir = fileURLToPath(new URL("../../app/", import.meta.url));

function routeFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...routeFiles(path, `${prefix}${entry}/`));
    else if (entry === "route.ts") out.push(`${prefix}${entry}`);
  }
  return out.sort();
}

/**
 * The seat's surfaces, read against the guards (Increment 1.106).
 *
 * The argument for letting an outside firm hold this seat is about what the
 * seat reads. That set grew three times after the argument was written, and
 * nothing read the two against each other — which is the same shape as
 * Increment 1.99's lapsed premises and Increment 1.105's stale claim.
 *
 * Read from the route files rather than asserted about them, for the reason
 * every other gate in this product is: a claim about which guards admit a
 * seat that does not read the guards goes stale in silence.
 */
describe("what the outside accountant's seat can reach", () => {
  const admits = routeFiles(join(appDir, "api"), "api/").filter((route) =>
    readFileSync(join(appDir, route), "utf8").includes("CPA_SEAT_ENTITLEMENT")
  );

  it("is exactly the set written down, with what the seat receives there", () => {
    expect(admits).toEqual(CPA_SURFACES.map((s) => s.route).sort());
  });

  it("says of every surface what the seat receives there", () => {
    for (const surface of CPA_SURFACES) {
      expect({ route: surface.route, said: surface.receives.length > 20 }).toEqual({
        route: surface.route,
        said: true,
      });
    }
  });

  /**
   * The two the live test cannot cover. Increment 1.49's case proves the
   * package names no patient by reading the practice's own patient rows and
   * searching for them; it can only do that for what the product derived. A
   * sentence somebody typed is outside its reach, and the argument has to say
   * so rather than read as though the package's shape settled everything.
   */
  it("names the surfaces carrying words a person typed", () => {
    expect(freeTextSurfaces().map((s) => s.route)).toEqual([
      "api/cpa/questions/route.ts",
      "api/controls/attestations/route.ts",
    ]);
  });
});
