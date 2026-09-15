import { describe, expect, it } from "vitest";
import { extractFacts } from "./extract";
import { clauseRanges, tokenize } from "./tokenize";

// THE NEWLINE-FLOOD REGRESSION, pinned.
//
// A 1,500-line pasted note parsed as ONE clause, because the tokenizer
// swallowed newlines as whitespace and the clause splitter never saw them.
// Two failures rode on that: assertion scoping inside a clause is
// O(facts × cues), so the paste cost 12 SECONDS on the per-keystroke path —
// and a "no" on line one was in scope to negate a finding forty lines down.
// A line break is a statement boundary in staff shorthand, and now it is one
// in the parser too.

describe("line breaks are clause boundaries", () => {
  it("negation never leaks across a line break", () => {
    const { facts } = extractFacts("no swelling\nbleeding on probing");
    const swelling = facts.find((f) => f.kind === "finding" && f.finding.includes("swelling"));
    const bleeding = facts.find((f) => f.kind === "finding" && f.finding.includes("bleeding"));
    expect(swelling?.assertion.polarity).toBe("negated");
    expect(bleeding?.assertion.polarity).toBe("affirmed");
  });

  it("each line is its own clause", () => {
    const tokens = tokenize("no swelling\nno bleeding\nno caries");
    expect(clauseRanges(tokens)).toHaveLength(3);
  });

  it("a wrapped clause without a break stays whole", () => {
    // No newline: the comma logic is unchanged.
    const tokens = tokenize("scaling and root planing, upper right quadrant");
    expect(clauseRanges(tokens)).toHaveLength(1);
  });

  it("a 1,500-line paste stays inside the keystroke budget", () => {
    const flood = "no swelling\n".repeat(1500);
    extractFacts(flood); // warm
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const s = performance.now();
      extractFacts(flood);
      best = Math.min(best, performance.now() - s);
    }
    // Measured 5 ms after the fix, 1,756 ms before it. The bound is loose for
    // shared CI runners and still two orders of magnitude below the bug.
    expect(best).toBeLessThan(250);
  });

  it("an unbroken wall of text is capped into bounded clauses", () => {
    // No punctuation, no newlines — the adversarial shape the ceiling exists
    // for. The guard splits it so assertion scoping stays linear.
    const wall = "no swelling ".repeat(1500).trim();
    const tokens = tokenize(wall);
    const clauses = clauseRanges(tokens);
    expect(clauses.length).toBeGreaterThan(1);
    for (const c of clauses) expect(c.to - c.from).toBeLessThanOrEqual(250);
    extractFacts(wall); // warm
    const s = performance.now();
    extractFacts(wall);
    expect(performance.now() - s).toBeLessThan(250);
  });
});
