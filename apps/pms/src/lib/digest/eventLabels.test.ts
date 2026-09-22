import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EVENT_LABEL } from "./digest";

const srcDir = fileURLToPath(new URL("../../", import.meta.url));

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // The browser suites name kinds in assertions, not in writes.
      if (name === "e2e") continue;
      out.push(...filesUnder(full));
    } else if ((name.endsWith(".ts") || name.endsWith(".tsx")) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** Every chain event kind this app writes, read from the source that writes it. */
function kindsWritten(): Set<string> {
  const kinds = new Set<string>();
  for (const file of filesUnder(srcDir)) {
    // digest.ts names kinds to read them, not to write them.
    if (file.endsWith("lib/digest/digest.ts")) continue;
    const text = stripComments(readFileSync(file, "utf8"));
    for (const m of text.matchAll(/append(?:Control|Domain)?Event\([^)]*?"([a-z_]+\.[a-z_.]+)"/gs)) kinds.add(m[1]);
    for (const m of text.matchAll(/kind:\s*"([a-z_]+\.[a-z_.]+)"/g)) kinds.add(m[1]);
  }
  return kinds;
}

/**
 * Every act this practice records has words for it (Increment 1.101).
 *
 * `chain.otherKinds` lists every kind the digest has no named field for, and
 * `eventLabel` falls back to the identifier with its punctuation swapped. That
 * fallback was carrying 29 of the 57 kinds this app writes, so most of the
 * practice's week read as "auth signin pending mfa" and "month rehash
 * baseline" — in the one artefact the owner stamps a hash of.
 *
 * Read from the source rather than asserted about it, for the reason the nav
 * gates and the route-guard checks are: a claim about what the code writes
 * that does not read the code goes stale in silence. A kind is covered when it
 * has a named digest field, a label, or a place the digest shows it from its
 * own table.
 */
describe("the words the weekly digest has for what happened", () => {
  it("has some for every kind this app writes", () => {
    const digestSource = readFileSync(join(srcDir, "lib/digest/digest.ts"), "utf8");
    const inBlock = (start: string, end: string) => {
      const i = digestSource.indexOf(start);
      const slice = digestSource.slice(i, digestSource.indexOf(end, i));
      return new Set([...slice.matchAll(/"([a-z_]+\.[a-z_.]+)"/g)].map((m) => m[1]));
    };
    const fields = inBlock("const EVENT_FIELDS", "};");
    const elsewhere = inBlock("EVENT_KINDS_SHOWN_ELSEWHERE = new Set(", ")");
    const covered = new Set([...fields, ...elsewhere, ...Object.keys(EVENT_LABEL)]);

    const missing = [...kindsWritten()].filter((k) => !covered.has(k)).sort();
    expect(missing).toEqual([]);
  });

  /**
   * `import.applied` sat in the list and nothing wrote it — the app writes
   * `import.bank_statement.applied` and `import.curve_hero.applied`. A label
   * for a kind nobody writes is a promise about a week that cannot happen.
   */
  it("has none for a kind this app does not write", () => {
    const written = kindsWritten();
    const stale = Object.keys(EVENT_LABEL)
      .filter((k) => !written.has(k))
      .sort();
    expect(stale).toEqual([]);
  });
});
