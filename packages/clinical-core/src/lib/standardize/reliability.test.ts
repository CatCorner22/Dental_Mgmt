import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";
import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { SHORTHAND } from "@/lib/vocab/shorthand";

// RELIABILITY, over BOTH vocabulary tables.
//
// property.test.ts pins idempotency, digit survival, negation survival and plural
// preservation as properties over every SHORTHAND entry, which is why it caught a
// duplicated dosing number the moment one was introduced. It iterates SHORTHAND
// only — and BANNED_ABBREVIATIONS is the MORE aggressive table: it replaces every
// occurrence directly rather than defining a term once. Twenty-one entries were
// added to it with no property coverage at all.
//
// This file closes that, and adds the two properties neither table had:
//
//   CASCADE. With 163 entries, one entry's output can be another entry's input.
//   The standard form the tool produces must be a FIXED POINT — if the tool
//   rewrites its own correct output, it is not a standardizer, it is a loop.
//
//   DETERMINISM. The same note must produce a byte-identical result every time,
//   in any process, whatever ran before it. A documentation tool whose output
//   depends on how warm something is cannot be trusted with a legal record.

/** Both tables, as one list of things that fire on note text. */
const STYLE_ABBREVIATIONS = BANNED_ABBREVIATIONS.filter((a) => a.severityClass === "style");
const EXPANDING_SHORTHAND = SHORTHAND.filter((s) => !s.alternatives);

function substantive(text: string) {
  return standardize(text).applied.filter((a) => a.kind !== "formatting");
}

describe("idempotency across the abbreviation table too", () => {
  it.each(STYLE_ABBREVIATIONS.map((a) => [a.display, a] as const))(
    "%s is stable three deep",
    (_display, abbr) => {
      // A seed that puts the abbreviation in a real sentence rather than alone,
      // because the sentence-casing and terminal-punctuation passes only run on
      // prose and are where idempotency broke historically.
      const seed = `Noted ${abbr.display} on tooth 19 during the visit`;
      const once = standardize(seed).text;
      const twice = standardize(once).text;
      const thrice = standardize(twice).text;
      expect(twice, `${abbr.display}: second pass changed the text`).toBe(once);
      expect(thrice, `${abbr.display}: third pass changed the text`).toBe(once);
    }
  );
});

describe("the standard form is a fixed point", () => {
  // The cascade test, and the one this file exists for. If expanding entry A
  // produces text that entry B then rewrites, the tool's own output is not
  // standard by its own rules — and a writer who accepts the suggestion and runs
  // the button again gets a different note.

  it.each(STYLE_ABBREVIATIONS.map((a) => [a.display, a.replacement] as const))(
    "the replacement for %s survives its own transformer",
    (display, replacement) => {
      const changed = substantive(replacement);
      expect(
        changed.map((c) => `"${c.from}" -> "${c.to}"`).join("; "),
        `${display}: the tool rewrites its own replacement text`
      ).toBe("");
    }
  );

  it.each(EXPANDING_SHORTHAND.map((s) => [s.display, s.expansion] as const))(
    "the expansion of %s survives its own transformer",
    (display, expansion) => {
      const changed = substantive(expansion);
      expect(
        changed.map((c) => `"${c.from}" -> "${c.to}"`).join("; "),
        `${display}: the tool rewrites its own expansion`
      ).toBe("");
    }
  );
});

describe("the transformer does not flag its own output", () => {
  // The other half of the fixed-point property, and the half that bites in the
  // UI. Expanding "b.i.d." produces "twice daily (bid)" — and a bare-"bid" rule
  // then flagged the parenthetical the tool had just written, so a writer who
  // accepted the suggestion was immediately told to go and fix it. Nothing erodes
  // trust faster than a tool disagreeing with itself in public.

  it.each(EXPANDING_SHORTHAND.map((s) => [s.display, s] as const))(
    "expanding %s does not raise a flag about the result",
    (display, entry) => {
      const seed = `Noted ${entry.display} on tooth 19 during the visit.`;
      const before = standardize(seed).flags.map((f) => f.display).sort();
      const after = standardize(standardize(seed).text).flags.map((f) => f.display).sort();
      // The second pass may not raise a flag the first did not. Losing one is
      // fine — that is the writer resolving something.
      const raised = after.filter((f) => !before.includes(f));
      expect(raised, `${display}: the expansion produced text the tool then flags`).toEqual([]);
    }
  );
});

describe("digits and negations survive the abbreviation table", () => {
  const digits = (s: string) => (s.match(/\d+/g) ?? []).sort().join(",");
  // "w/o" counts as a negation, because it IS one — that is the entire reason the
  // entry exists. Omitting it made this comparison report the correct expansion of
  // "w/o" to "without" as a negation appearing out of nowhere. The shorthand and
  // the word it stands for have to be counted as the same thing, or a test of
  // negation preservation fails on the one entry whose job is preserving a negation.
  const negations = (s: string) =>
    (s.match(/\bw\/o\b|\b(?:no|not|never|denies|denied|without)\b/gi) ?? [])
      .map((x) => (x.toLowerCase() === "w/o" ? "without" : x.toLowerCase()))
      .sort()
      .join(",");

  it.each(STYLE_ABBREVIATIONS.map((a) => [a.display, a.display] as const))(
    "numbers around %s are untouched",
    (label, token) => {
      const seed = `On 2019-03: 4 ${token} for tooth 19, depth 5 mm, 2 carpules.`;
      const out = standardize(seed).text;
      // "q6h" and friends contain their own digit; comparing multisets is what
      // caught "every 6 hours (q6h)" carrying the number 6 twice.
      expect(digits(out), `${label} altered the numbers`).toBe(digits(seed));
    }
  );

  it.each(STYLE_ABBREVIATIONS.map((a) => [a.display, a.display] as const))(
    "a negated sentence containing %s stays negated",
    (label, token) => {
      const seed = `No bleeding and not ${token} today. Denies pain.`;
      const out = standardize(seed).text;
      expect(negations(out), `${label} changed a negation`).toBe(negations(seed));
    }
  );
});

describe("determinism", () => {
  const NOTE =
    "pt c/o pain UL x3 days. no swelling. ibuprofen 400mg q6h prn. perc + on #14. " +
    "pa shows periapical radiolucency. dx irreversible pulpitis. plan rct #14, referred to endo. " +
    "srp UR. pd 4-6mm w/ bop. ext #17 w/ forceps, 2 carpules lido w/ epi. nka. f/u prn.";

  it("returns a byte-identical result on fifty consecutive runs", () => {
    const first = standardize(NOTE);
    for (let i = 0; i < 50; i++) {
      const again = standardize(NOTE);
      expect(again.text).toBe(first.text);
      expect(again.applied.length).toBe(first.applied.length);
      expect(again.flags.length).toBe(first.flags.length);
    }
  });

  it("does not depend on what was standardized before it", () => {
    // Regex objects in the tables carry the g flag, and a `lastIndex` left behind
    // by an earlier call is the classic way a shared pattern starts skipping
    // matches on the next one. Interleaving proves nothing is carried over.
    const clean = standardize(NOTE).text;
    standardize("SRP UR quad. RCT #19. NKDA. w/o complication. 500 mg q6h.");
    standardize("".padEnd(5000, "x "));
    standardize("Dr. Smith called about tooth 3 on 03/14/1980.");
    expect(standardize(NOTE).text).toBe(clean);
  });

  it("reports the same change list, in the same order, every time", () => {
    // The staff member reads this list and accepts it. An order that shuffles
    // between runs makes the same note look like a different suggestion.
    const a = standardize(NOTE).applied.map((x) => `${x.kind}:${x.from}->${x.to}`);
    const b = standardize(NOTE).applied.map((x) => `${x.kind}:${x.from}->${x.to}`);
    expect(b).toEqual(a);
  });
});

describe("it stays fast enough to run on every field", () => {
  it("standardizes a full-length note well inside a keystroke budget", () => {
    // The inline builder button runs this in the BROWSER, on one field, on a
    // device several times slower than CI. 163 entries means ~326 full-text
    // regex scans, so the scaling is worth pinning: measured 0.17 ms on a typical
    // field and 18 ms on a note four times longer than the 20,000-character cap.
    const field = "pt c/o pain UL x3 days, no swelling, ibuprofen 400mg q6h prn. ".repeat(8);
    standardize(field); // warm
    const start = performance.now();
    for (let i = 0; i < 20; i++) standardize(field);
    expect((performance.now() - start) / 20).toBeLessThan(50);
  });

  it("does not degrade superlinearly as the note grows", () => {
    // MINIMUM of several runs, not a single sample. This assertion failed on a
    // shared CI runner at ratio 49, then again at 40.41 with a ceiling of 40 —
    // both with no code change in the hot path. The small measurement is
    // sub-millisecond, so one GC pause or noisy-neighbor slice during it
    // distorts the ratio arbitrarily. Scheduling noise only ever ADDS time,
    // which makes the minimum the robust estimator of what the code actually
    // costs — the ratio of minima is stable where the ratio of single samples
    // is a coin flip. Floor + more samples + a modest ceiling keep the
    // "not quadratic" contract without red-lighting main on runner noise.
    const unit = "srp UR quad, pd 4-6mm w/ bop, ext #17 w/ forceps, 2 carpules lido w/ epi. ";
    const time = (reps: number) => {
      const text = unit.repeat(reps);
      standardize(text); // warm
      standardize(text); // second warm — first post-JIT sample is still noisy
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        const s = performance.now();
        standardize(text);
        best = Math.min(best, performance.now() - s);
      }
      return best;
    };
    // Sub-0.1 ms floors make the ratio a lottery when the runner hiccups on
    // the small case alone; 0.1 ms is still far below a keystroke budget.
    const small = Math.max(time(20), 0.1);
    const large = time(200);
    // Ten times the input must not cost anywhere near a hundred times the work.
    expect(large / small).toBeLessThan(50);
  });
});
