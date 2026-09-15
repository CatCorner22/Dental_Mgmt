import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BANNED_ABBREVIATIONS } from "./abbreviations";
import { STALE_PHRASES, STIGMATIZING_PHRASES, VAGUE_PHRASES } from "./vague-phrases";
import { PLAIN_WORDS } from "./plain-language";

// Smile Notes tells staff the same rules in two places, and they were kept in
// step by hand:
//
//   /reference/terminology   renders the markdown below, hand-typed.
//   /reference/abbreviations renders the TypeScript tables, generated.
//
// Nothing compared them. The coupling existed only as a comment at the top of
// each vocab module saying it "mirrors" the markdown, which is a promise with
// no enforcement — so the two pages could disagree in production and no test
// would fail.
//
// They HAD diverged, and in the direction that matters most. `U`, `IU`, and
// `MS / MSO4 / MgSO4` — the Joint Commission "Do Not Use" entries, the ones
// that exist because "10U" gets read as "100" — were added to the code and
// never reached the staff-facing table. A hygienist reading the terminology
// page was told the tool checked a smaller set than it does. In the other
// direction the markdown promised a check on "large" that was never
// implemented, which is worse: the tool claimed a safety net it did not have.
//
// This test compares the TERM SETS in both directions. It deliberately does
// NOT compare the guidance prose — a compact table cell and a findings-panel
// suggestion are allowed to be worded differently, and forcing them to match
// would push toward duplicating strings rather than keeping the lists honest.

const DOC = path.join(process.cwd(), "skill/references/terminology-and-style.md");
const markdown = readFileSync(DOC, "utf8");

/**
 * First column of every data row under a `## heading`, up to the next heading.
 */
function docTerms(heading: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) throw new Error(`heading not found in the reference doc: ${heading}`);
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{2,3} /.test(lines[i])) break;
    const cell = lines[i].match(/^\|\s*([^|]+?)\s*\|/)?.[1]?.trim();
    if (!cell) continue;
    if (/^-+$/.test(cell)) continue; // |---| separator
    if (cell === "Avoid" || cell === "Signal") continue; // header row
    out.push(cell);
  }
  return out;
}

/**
 * Canonical key for one entry, applied identically to both sides.
 *
 * The markdown writes alternation as "BW or BWX" because that reads better in
 * a sentence; the code writes "BW / BWX". Splitting on the separators and
 * sorting makes those the same key. Applying it symmetrically means any
 * artifact of the split cancels out — "and/or" becomes the same token pair on
 * both sides, so the entry still matches itself.
 *
 * Parentheticals are dropped so the code's "U (units)" matches the doc's "U".
 */
function key(display: string): string {
  return display
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .split(/\s*(?:\/|,|\bor\b)\s*/)
    .map((t) => t.trim())
    .filter(Boolean)
    .sort()
    .join("/");
}

const TABLES: Array<{ heading: string; list: ReadonlyArray<{ display: string }>; name: string }> = [
  {
    heading: "## Replace ambiguous shorthand",
    list: BANNED_ABBREVIATIONS,
    name: "BANNED_ABBREVIATIONS"
  },
  { heading: "## Replace vague or unsafe phrases", list: VAGUE_PHRASES, name: "VAGUE_PHRASES" },
  {
    heading: "## Copy-forward and stale-text signals",
    list: STALE_PHRASES,
    name: "STALE_PHRASES"
  },
  {
    heading: "## Words that label the patient",
    list: STIGMATIZING_PHRASES,
    name: "STIGMATIZING_PHRASES"
  },
  {
    heading: "## Plain words for patient-facing text",
    list: PLAIN_WORDS,
    name: "PLAIN_WORDS"
  }
];

describe("the two staff-facing rule lists cannot drift apart", () => {
  for (const { heading, list, name } of TABLES) {
    describe(`${name} vs "${heading.replace(/^## /, "")}"`, () => {
      it("documents every rule the tool actually enforces", () => {
        // The direction that bit us. A rule the code applies but the doc omits
        // means staff are corrected by a rule they were never shown.
        const documented = new Set(docTerms(heading).map(key));
        const undocumented = list.map((e) => e.display).filter((d) => !documented.has(key(d)));
        expect(
          undocumented,
          `${name} entries missing from ${DOC} under "${heading}"`
        ).toEqual([]);
      });

      it("promises no rule the tool does not enforce", () => {
        // The worse direction. A doc row with no implementation is the app
        // claiming a safety net it does not have.
        const implemented = new Set(list.map((e) => key(e.display)));
        const unimplemented = docTerms(heading).filter((t) => !implemented.has(key(t)));
        expect(
          unimplemented,
          `rows under "${heading}" in ${DOC} with no matching entry in ${name}`
        ).toEqual([]);
      });
    });
  }

  it("finds a real table under every heading, so a renamed heading fails loudly", () => {
    // Without this, deleting a table would make both assertions above pass
    // vacuously — the emptiest possible way for the check to stop working.
    for (const { heading, list, name } of TABLES) {
      expect(docTerms(heading).length, `${heading} is empty`).toBeGreaterThan(0);
      expect(list.length, `${name} is empty`).toBeGreaterThan(0);
    }
  });
});

describe("the Joint Commission do-not-use entries reach the staff page", () => {
  // Named explicitly rather than left to the set comparison. These are the
  // reason the parity test exists, and a regression here is a dose-safety
  // regression, not a documentation nit.
  it("lists U, IU, and the MS family", () => {
    const documented = docTerms("## Replace ambiguous shorthand").map(key);
    for (const term of ["U (units)", "IU", "MS / MSO4 / MgSO4"]) {
      expect(documented, `${term} must appear in the staff terminology table`).toContain(key(term));
    }
  });
});
