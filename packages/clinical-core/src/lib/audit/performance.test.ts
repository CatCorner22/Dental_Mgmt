import { describe, expect, it } from "vitest";
import { runTextAudit } from "./engine";

// The audit runs on every keystroke in the browser and on up to 200,000
// characters in the email route. No pattern may degrade superlinearly.
describe("audit performance", () => {
  const budgetMs = 1000;

  it.each([
    ["digit-and-dash run", "123-45-".repeat(10_000) + "6789"],
    // UNBROKEN digit runs, which the dashed case above cannot exercise.
    //
    // This is where the obfuscation screen went wrong. Its first pattern was
    // `\p{Nd}*(?![0-9])\p{Nd}\p{Nd}*` — a leading `\p{Nd}*` that consumed to the
    // end of a digit run and backtracked through every remaining position looking
    // for a non-ASCII digit that never came, once per start position. Quadratic,
    // inside the per-keystroke audit: 1.8 ms at 1,000 digits, 28 ms at 4,000,
    // 445 ms at 16,000, 6.5 SECONDS at 64,000.
    //
    // Every dash in the case above breaks the run into seven characters, so the
    // blowup needed a length this file never produced. A rule that walks digit
    // runs has to be measured on digit runs.
    ["unbroken ASCII digit run", "1".repeat(60_000)],
    ["unbroken mixed digit run", "1234567890".repeat(6_000)],
    ["digit run with one foreign digit at the end", "1".repeat(60_000) + "\u0665"],
    ["hyphenated word run", "a-".repeat(30_000)],
    ["max-payload word run", "a-".repeat(100_000)],
    ["unclosed placeholders", "<".repeat(20_000) + ">".repeat(20_000)],
    ["repeated honorifics", "Dr. ".repeat(10_000) + "Smith"],
    ["long prose", "The clinician observed generalized plaque. ".repeat(500)]
  ])("stays under budget on %s", (_label, input) => {
    const start = performance.now();
    runTextAudit(input);
    expect(performance.now() - start).toBeLessThan(budgetMs);
  });

  it("still detects email addresses after the bounded-quantifier fix", () => {
    for (const text of [
      "write to a@b.com",
      "jane.doe+tag@sub.example.org",
      "x@y.z",
      "user_name@clinic-office.co.uk"
    ]) {
      expect(runTextAudit(text).some((f) => f.ruleId === "phi.email"), text).toBe(true);
    }
    for (const text of ["bad@", "@bad.com", "no address here"]) {
      expect(runTextAudit(text).some((f) => f.ruleId === "phi.email"), text).toBe(false);
    }
  });
});
