import { describe, expect, it } from "vitest";
import { runPrecisionEval, formatFalsePositives } from "./precision-eval";
import { CLEAN_CORPUS, type Hazard } from "./clean-corpus";
import { SHORTHAND_CORPUS } from "@/lib/extract/corpus";
import { runTextAudit } from "../engine";

// The gate this file holds is the one that decides whether staff keep reading the
// audit panel. See precision-eval.ts for why blocking findings are held at zero
// rather than at 98 percent.

/**
 * Advisory noise per note. A ratchet: it may be lowered when the rules improve
 * and must never be raised to make a change pass.
 */
const ADVISORY_CEILING = 12;

/** Below this the corpus is too small for "zero" to mean anything. */
const CORPUS_FLOOR = 25;

const ALL_HAZARDS: Hazard[] = [
  "eponym",
  "institution",
  "vendor",
  "given-name-word",
  "anatomy-word",
  "tooth-run",
  "long-number",
  "measurement",
  "drug-name",
  "punctuation"
];

describe("the audit does not stop notes that are already correct", () => {
  const report = runPrecisionEval();

  it("raises no blocking finding on any clean note", () => {
    expect(report.blockingFalsePositives, formatFalsePositives(report)).toEqual([]);
  });

  it("keeps advisory noise under the ratchet", () => {
    // Not zero, and it should not be: an S2 asking someone to look at a word
    // costs a glance, not a filing. It is capped so the panel stays readable.
    expect(report.advisoryPerNote).toBeLessThanOrEqual(ADVISORY_CEILING);
  });
});

describe("the corpus cannot be quietly narrowed until it passes", () => {
  // Without these, the cheapest way to make the gate above green is to delete the
  // notes that fail it. Mirrors the anti-vacuity test in assist/evals/scorer.test.ts.
  const report = runPrecisionEval();

  it("holds enough notes for zero to be a claim", () => {
    expect(report.notes).toBeGreaterThanOrEqual(CORPUS_FLOOR);
  });

  it("exercises every hazard, at least twice", () => {
    const counts = new Map<Hazard, number>();
    for (const note of CLEAN_CORPUS) {
      for (const h of note.hazards) counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    const thin = ALL_HAZARDS.filter((h) => (counts.get(h) ?? 0) < 2);
    expect(
      thin,
      `These hazards are carried by fewer than two notes, so a regression in the ` +
        `matching rule could pass unnoticed: ${thin.join(", ")}`
    ).toEqual([]);
  });

  it("gives every note a reason for being here", () => {
    for (const note of CLEAN_CORPUS) {
      expect(note.why.length, note.id).toBeGreaterThan(30);
      expect(note.text.length, note.id).toBeGreaterThan(120);
      expect(note.hazards.length, note.id).toBeGreaterThan(0);
    }
  });

  it("can still fail — a genuinely defective note is caught", () => {
    // The canary. Without it, emptying the corpus makes this file pass, and a
    // harness that cannot fail is worse than no harness because it reports safety.
    const defective = [
      {
        id: "canary",
        noteType: "canary",
        text: "Pt is a liar, refuses tx. asdfasdf. Called 555-11-2323 on 03/14/2024.",
        hazards: ["given-name-word"] as Hazard[],
        why: "Deliberately defective: the harness must report this as blocking."
      }
    ];
    const canary = runPrecisionEval(defective);
    expect(canary.blockingFalsePositives.length).toBeGreaterThan(0);
  });
});

describe("precision was not bought with recall", () => {
  it("still blocks the shorthand corpus", () => {
    // SHORTHAND_CORPUS is deliberately telegraphic and abbreviation-dense. It
    // SHOULD produce blocking findings. If a narrowing made to clear the clean
    // corpus ever silences this one too, the rules were not narrowed — they were
    // gutted, and this is where that shows up.
    const blocked = SHORTHAND_CORPUS.filter((n) =>
      runTextAudit(n.text).some((f) => f.severity === "S0" || f.severity === "S1")
    );
    expect(
      blocked.length,
      "the shorthand corpus stopped producing blocking findings — a narrowing went too far"
    ).toBeGreaterThan(SHORTHAND_CORPUS.length / 2);
  });
});
