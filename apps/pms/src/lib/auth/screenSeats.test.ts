import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NAV_LINKS } from "./seats";

const appDir = fileURLToPath(new URL("../../app/(app)/", import.meta.url));

/**
 * Every screen the product has, and the seat that names it (Increment 1.104).
 *
 * `seats.test.ts` reads each catalog entry against the route it names, so a
 * link cannot promise a screen that refuses. Nothing read the other direction:
 * a screen with no entry is a screen the header cannot offer, and Increment
 * 1.72's lesson — a mechanism nobody can find is not a mechanism — applies to
 * a whole screen more than to an act on one.
 *
 * `/reason-codes` was that screen. It was reachable from one hardcoded link on
 * the owner's home board and from nowhere else, so the seat its list exists
 * for — the seat that posts, and must choose among the reasons — could not
 * find it at all.
 *
 * Read from the filesystem rather than asserted about it, for the reason the
 * route-guard checks are: a claim about which screens exist that does not read
 * the directory goes stale in silence.
 */

/**
 * A screen a person reaches by choosing a row on its parent, never by name.
 * Each is listed with the screen that leads to it, because "it has no seat" is
 * only acceptable where something else already carries the reader there.
 */
const REACHED_FROM_A_PARENT: Record<string, string> = {
  "/ledger/[accountId]": "an account chosen on /ledger",
  "/reconciliation/[runId]": "a run chosen on /reconciliation",
  "/statements/[id]": "a statement chosen on /statements",
};

function screens(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...screens(path, `${prefix}/${entry}`));
    else if (entry === "page.tsx") out.push(prefix === "" ? "/" : prefix);
  }
  return out.sort();
}

describe("every screen the product has", () => {
  const all = screens(appDir);
  const named = new Set(NAV_LINKS.map((l) => l.href));

  it("is named by a seat, or is reached from a parent screen with its reason written down", () => {
    const unreachable = all.filter((href) => !named.has(href) && !(href in REACHED_FROM_A_PARENT));
    expect(unreachable).toEqual([]);
  });

  /** The other direction: a seat naming a screen that does not exist. */
  it("exists for every seat that names one", () => {
    expect(NAV_LINKS.map((l) => l.href).filter((href) => !all.includes(href))).toEqual([]);
  });

  /** A parent listed here must itself be a screen, or the reason is not a reason. */
  it("leads to each parent-reached screen from a screen that exists", () => {
    for (const href of Object.keys(REACHED_FROM_A_PARENT)) {
      expect({ href, parent: all.includes(href.slice(0, href.lastIndexOf("/"))) }).toEqual({ href, parent: true });
    }
    // And nothing is excused that no longer needs excusing.
    expect(Object.keys(REACHED_FROM_A_PARENT).filter((href) => !all.includes(href))).toEqual([]);
  });
});
