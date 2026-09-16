import { describe, expect, it } from "vitest";
import { SHORTHAND_CORPUS } from "./corpus";
import { extractFacts } from "./extract";

// PARSER COVERAGE, MEASURED AND RATCHETED.
//
// The floor below is not a target, it is a ratchet: it records what the parser
// could read on the day it was last raised, and it fails if that regresses. The
// number is allowed to be unimpressive. What is not allowed is for it to be
// unknown, because a parser whose real-world coverage nobody measures is a
// parser that quietly stops working as the vocabulary drifts.
//
// The MISS list this prints is the growth signal — the phrases staff really
// type that the grammar cannot read yet, as opposed to the ones we imagined.

// Raised from 0.55 once medications, measurements, findings, materials and care
// events landed. Measured 26.2% when the parser knew only teeth and procedures;
// 94.6% now. The floor sits below the measurement so that adding a hard note to
// the corpus is not itself a failure — growing the corpus must stay cheap, or
// it stops growing and the number stops meaning anything.
const CLAUSE_COVERAGE_FLOOR = 0.9;

describe("coverage on shorthand as staff actually type it", () => {
  it("reports where the parser is blind", () => {
    let clauses = 0;
    let unparsed = 0;
    const misses: string[] = [];

    for (const note of SHORTHAND_CORPUS) {
      const result = extractFacts(note.text);
      clauses += result.clauseCount;
      unparsed += result.unparsed.length;
      for (const span of result.unparsed) misses.push(note.text.slice(span.start, span.end));
    }

    const overall = (clauses - unparsed) / clauses;
    // eslint-disable-next-line no-console
    console.log(
      `\nPARSER COVERAGE: ${(overall * 100).toFixed(1)}% of ${clauses} clauses\n` +
        misses.map((m) => `  MISS: ${m}`).join("\n")
    );
    expect(overall).toBeGreaterThanOrEqual(CLAUSE_COVERAGE_FLOOR);
  });

  it("reads at least one fact from every note in the corpus", () => {
    // A note the parser reads NOTHING from is the worst case: the chart is
    // blank and the writer has no signal that anything was missed.
    for (const note of SHORTHAND_CORPUS) {
      expect(extractFacts(note.text).facts.length, `${note.id} yielded no facts`).toBeGreaterThan(0);
    }
  });

  it("never invents a tooth anywhere in the corpus", () => {
    // Every tooth the parser reports must appear in the note preceded by an
    // introducer. Carpule counts, millimetres and percentages are everywhere in
    // this corpus and none of them is a tooth.
    for (const note of SHORTHAND_CORPUS) {
      for (const fact of extractFacts(note.text).facts) {
        const sites = fact.kind === "tooth-site" ? [fact.site] : fact.kind === "procedure" ? fact.sites : [];
        for (const site of sites) {
          const before = note.text.slice(Math.max(0, site.span.start - 12), site.span.start);
          expect(
            /[#]\s*$|\b(?:tooth|teeth|no\.)\s*$|[,&-]\s*$|\band\s*$|\d\s*$/i.test(before),
            `${note.id}: tooth ${site.toothId} has no introducer in "${before}"`
          ).toBe(true);
        }
      }
    }
  });

  it("stays fast across the whole corpus", () => {
    const started = performance.now();
    for (let i = 0; i < 50; i++) for (const note of SHORTHAND_CORPUS) extractFacts(note.text);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
