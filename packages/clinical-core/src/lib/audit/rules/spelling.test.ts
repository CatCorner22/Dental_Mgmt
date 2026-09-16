import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLOSE_CHECKS,
  __resetCloseMatchCache,
  newSpellingBudget,
  runSpellingRule
} from "./spelling";

// The close-match scan is memoized because it was ~80% of the per-keystroke
// audit cost. A cache in front of a rule that grades a legal record has to earn
// it: these are the properties that make the cache invisible to the output.

const ids = (text: string, budget = newSpellingBudget()) =>
  runSpellingRule(text, undefined, budget).map((f) => [f.ruleId, f.matchedText, f.suggestion]);

describe("the cache is invisible to the findings", () => {
  it("reports the same thing cold and warm", () => {
    const text =
      "Drained the abcess near the gingiva, then charted periodontal probing depths and " +
      "noted amoxicilin on the medication list alongside a flurbbile nonsense word.";
    __resetCloseMatchCache();
    const cold = ids(text);
    const warm = ids(text); // cache now populated by the run above
    expect(warm).toEqual(cold);
    expect(cold.length).toBeGreaterThan(0);
  });

  it("finds the same close match whether or not the word was seen before", () => {
    // "periodontl" is one deletion from "periodontal".
    __resetCloseMatchCache();
    const first = ids("periodontl pocketing noted.");
    const second = ids("periodontl pocketing noted.");
    expect(first).toEqual(second);
    expect(first.some(([rule]) => rule === "spelling.close-match")).toBe(true);
  });

  it("caches the ABSENCE of a close match too, and still says nothing about it", () => {
    // The common case: a word that is close to nothing in the lexicon must not
    // acquire a suggestion on a later pass just because it was cached.
    __resetCloseMatchCache();
    const cold = ids("The zzzqqqxxvv observation stands.");
    const warm = ids("The zzzqqqxxvv observation stands.");
    expect(warm).toEqual(cold);
    expect(cold.every(([, , suggestion]) => suggestion === undefined)).toBe(true);
  });

  it("survives a cache overflow without changing its answer", () => {
    __resetCloseMatchCache();
    const expected = ids("periodontl pocketing noted.");
    // Push well past CLOSE_MATCH_CACHE_MAX so the clear-on-full path runs.
    for (let i = 0; i < 5000; i++) {
      runSpellingRule(`filler${i}word`, undefined, newSpellingBudget());
    }
    expect(ids("periodontl pocketing noted.")).toEqual(expected);
  });
});

describe("the budget is spent on attempts, not on cache misses", () => {
  // This is the property that keeps a frozen audit report a fact about the note
  // rather than about the machine that graded it. If the cache paid for itself
  // out of the budget, a warm process would afford more close-match scans than
  // a cold one and the same note would grade differently in two deployments.
  it("charges a repeated word every time it is looked up", () => {
    __resetCloseMatchCache();
    const budget = newSpellingBudget();
    runSpellingRule("periodontl", undefined, budget);
    const afterFirst = budget.closeChecks;
    expect(afterFirst).toBe(DEFAULT_CLOSE_CHECKS - 1);
    // Same word, now cached. It must still cost a check.
    runSpellingRule("periodontl", undefined, budget);
    expect(budget.closeChecks).toBe(afterFirst - 1);
  });

  it("stops looking once the budget is gone, warm cache or not", () => {
    // Prime the cache so a cheap lookup is available, then prove exhaustion
    // still degrades to "no close-match suggestions" exactly as before.
    __resetCloseMatchCache();
    runSpellingRule("periodontl", undefined, newSpellingBudget());
    const spent = { closeChecks: 0 };
    const findings = runSpellingRule("periodontl", undefined, spent);
    expect(findings.some((f) => f.ruleId === "spelling.close-match")).toBe(false);
  });
});

describe("what the rule is for still works", () => {
  it("keeps a medication typo at S2 for a clinician to verify", () => {
    const findings = runSpellingRule("Dispensed amoxicilin as directed.");
    const med = findings.find((f) => f.ruleId === "spelling.medication");
    expect(med?.severity).toBe("S2");
    // Never a computed correction applied on the tool's own authority.
    expect(med?.message).toContain("verifies the drug against the source record");
  });

  it("leaves an ordinary acronym alone", () => {
    // ALL-CAPS words reach the medication check but must not generate the
    // generic unknown-word note, or every EDR/BWX/PARL in the practice's
    // vocabulary becomes a finding.
    const findings = runSpellingRule("Reviewed the BWX in the EDR and noted PARL.");
    expect(findings.some((f) => f.ruleId === "spelling.unknown-word")).toBe(false);
  });
});
