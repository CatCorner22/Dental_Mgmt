import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";
import { SHORTHAND } from "@/lib/vocab/shorthand";

// PROPERTY TESTS over the whole shorthand table. Example-based suites pin the
// bugs we have already seen; these hold for every entry that exists NOW and
// every entry anyone adds LATER, which is the moment this class of bug
// actually arrives (a new pattern fitted to the shape of a match without its
// context — the entire Chicken Little family).

describe("property: standardize is idempotent for every shorthand entry", () => {
  it("standardize(standardize(x)) === standardize(x), three deep, all entries", () => {
    const failures: string[] = [];
    for (const sh of SHORTHAND) {
      const seeds = [
        `Finding: ${sh.display} noted at the visit.`,
        `Finding: ${sh.display.toLowerCase()} noted at the visit.`,
        `${sh.display} recorded. Later the ${sh.display} was reviewed.`
      ];
      for (const seed of seeds) {
        const once = standardize(seed).text;
        const twice = standardize(once).text;
        const thrice = standardize(twice).text;
        if (twice !== thrice) {
          failures.push(`${sh.id}: ${JSON.stringify(twice)} != ${JSON.stringify(thrice)}`);
        }
        // A nested parenthetical definition is the signature of the BWX bug.
        if (/\([^()]*\([^()]*\)/.test(thrice)) {
          failures.push(`${sh.id} NESTED: ${JSON.stringify(thrice)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("property: digits survive every entry's expansion", () => {
  it("numbers around any shorthand are untouched", () => {
    const failures: string[] = [];
    for (const sh of SHORTHAND) {
      const seed = `On 2019-03: 4 ${sh.display} for tooth 19, depth 5 mm, 2 carpules.`;
      const out = standardize(seed).text;
      const before = seed.match(/\d+/g) ?? [];
      const after = out.match(/\d+/g) ?? [];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        failures.push(`${sh.id}: ${JSON.stringify(out)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("property: negations survive every entry's expansion", () => {
  it("a negated sentence stays negated", () => {
    const failures: string[] = [];
    for (const sh of SHORTHAND) {
      const seed = `No ${sh.display} indicated; patient denies symptoms and did not consent.`;
      const out = standardize(seed).text.toLowerCase();
      for (const neg of ["no ", "denies", "not "]) {
        if (!out.includes(neg)) failures.push(`${sh.id} lost "${neg.trim()}": ${JSON.stringify(out)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("property: ambiguous entries never expand", () => {
  it("alternatives always flag, never rewrite", () => {
    for (const sh of SHORTHAND) {
      if (!sh.alternatives) continue;
      const seed = `Noted ${sh.display} in the history.`;
      const r = standardize(seed);
      expect(r.text, sh.id).toContain(sh.display);
      expect(r.text.toLowerCase(), sh.id).not.toContain(sh.expansion.toLowerCase());
    }
  });
});

describe("property: plural tokens never lose their plurality", () => {
  it("s-suffixed matches keep a plural on the visible token", () => {
    const failures: string[] = [];
    for (const sh of SHORTHAND) {
      if (sh.alternatives) continue;
      // Only entries whose pattern actually matches a plural token.
      const pluralToken = `${sh.display}s`;
      const re = new RegExp(sh.pattern.source, sh.pattern.flags);
      if (!re.test(pluralToken)) continue;
      const out = standardize(`Multiple ${pluralToken} documented.`).text;
      // Either the plural expansion appears, or the plural token survives —
      // a singular expansion of a plural token is the one forbidden outcome.
      const keptPlural =
        /s\b/.test(out.match(/\(([^)]+)\)/)?.[1] ?? "") || out.includes(pluralToken);
      const expandedSingular =
        sh.pluralExpansion === undefined &&
        out.toLowerCase().includes(`${sh.expansion.toLowerCase()} (${sh.display.toLowerCase()})`);
      if (!keptPlural || expandedSingular) {
        failures.push(`${sh.id}: ${JSON.stringify(out)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
