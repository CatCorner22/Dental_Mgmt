// CONTEXT — is this fact asserted, denied, hypothetical, or about someone else?
//
// An implementation of the ConText algorithm (Chapman, Chu & Dowling, BioNLP
// 2007; extended by Harkema et al., J Biomed Inform 2009), which is itself the
// generalisation of NegEx (Chapman et al., J Biomed Inform 2001). Pure token
// matching against three declarative term tables. No model, no training data,
// no statistics — every decision traces to a named entry in a table below, and
// the entry's id is carried on the result so a finding can say WHICH WORD
// decided it rather than "the system thought so".
//
// ===========================================================================
// WHY THIS SHIPS WITH THE EXTRACTOR AND NOT AFTER IT
//
// An extractor without an assertion layer is not a weaker version of one with
// it — it is a hazard. "No caries #14" and "caries #14" tokenize almost
// identically, so a naive extractor reports a caries fact for a tooth the note
// explicitly called clean, and the odontogram paints it. The chart would then
// contradict the record it was drawn from, which is worse than having no chart.
// ===========================================================================
//
// THE MEASURED NUMBERS, and what we do differently because of them.
//
//   Negation      97% recall / 97% precision  -> ASSIGNED
//   Hypothetical  82.5% / 94.3%               -> hinted
//   Historical    67.4% / 74.2%               -> hinted
//   Experiencer   50% / 100% (n=8)            -> hinted
//
// Only negation clears the bar for being decided automatically. The rest are
// surfaced as cues for a human, because in a dental note the historical/current
// distinction is the difference between charting someone else's old crown and
// claiming for a new one, and a 67%-recall guess about that is not a feature.
//
// KNOWN FAILURE MODES, taken from the papers' own error analyses and storm-
// tested in context.test.ts:
//   - a trigger landing between two words of one concept ("chest wall is
//     without tenderness")
//   - relative clauses killing scope early via a terminator
//   - double negatives and genuine human ambiguity
//   - the commonest cause by far: a trigger nobody put in the table
//
// The last one is why an UNRECOGNISED construct must never become an affirmed
// fact by default in a place where that is dangerous. It is handled at the call
// site in extract.ts, not here.

import type { Assertion, Trigger } from "./facts";
import type { Token } from "./tokenize";

type Category = "negation" | "historical" | "hypothetical" | "experiencer";

/**
 * `pseudo` blocks a trigger that would otherwise match at the same position
 * ("no increase" contains "no" but denies nothing). `terminate` cuts a scope
 * short. The rest carry scope in the named direction.
 *
 * Modelling pseudo-triggers and terminators as DIRECTIONS on one rule type,
 * rather than as three parallel lists, is medspaCy's refinement of the
 * published algorithm and it is cleaner: one table, one matcher, one place to
 * look when a term misbehaves.
 */
type Direction = "forward" | "backward" | "bidirectional" | "terminate" | "pseudo";

interface ContextRule {
  id: string;
  /** Lowercased token sequence. Multi-token entries match in order. */
  literal: string[];
  category: Category;
  direction: Direction;
  /**
   * Tokens of scope. Undefined means "to the end of the clause", which is
   * ConText's default and which works because we already split on the commas
   * a dental note uses to separate assertions.
   *
   * An explicit narrow scope is the published fix for over-reach: "previous"
   * extends exactly one term forward, so "for previous headache" marks the
   * headache historical without dragging the rest of the clause with it.
   */
  maxScope?: number;
}

const rule = (
  id: string,
  literal: string,
  category: Category,
  direction: Direction,
  maxScope?: number
): ContextRule => ({ id, literal: literal.split(" "), category, direction, maxScope });

// ---------------------------------------------------------------------------
// PSEUDO-TRIGGERS. Listed FIRST because longest-match-wins ordering matters:
// "no increase" must beat "no".
// ---------------------------------------------------------------------------
const PSEUDO: ContextRule[] = [
  "no increase",
  "no change",
  "no interval change",
  "no significant change",
  "no further",
  "not extend",
  "not extending",
  "not cause",
  "not only",
  "not necessarily",
  "not rule out",
  "not ruled out",
  "cannot be excluded",
  "cannot rule out",
  "gram negative",
  // An omission licence, not a clinical denial. "Not applicable" as a field
  // answer says the question does not apply here; it does not deny a finding,
  // and omissions.ts already counts it as the different thing it is.
  //
  // DELIBERATELY ABSENT: "no caries noted". An earlier version of this list had
  // it, which was a straight error — it is the single most common negated
  // finding in a dental note and treating it as a pseudo-trigger meant every
  // clean exam reported caries. Caught by the corpus measurement, not by
  // inspection.
  "not applicable"
].map((literal, i) => rule(`pseudo.${i}`, literal, "negation", "pseudo"));

// ---------------------------------------------------------------------------
// NEGATION. The published per-phrase precision is the reason some obvious
// candidates are missing: "versus" measured 0% PPV and is deliberately absent.
// ---------------------------------------------------------------------------
const NEGATION: ContextRule[] = [
  // Forward: trigger, then the thing it denies.
  ...[
    "no evidence of",
    "no sign of",
    "no signs of",
    "no complaints of",
    "no complaint of",
    "no history of",
    "negative for",
    "denies",
    "denied",
    "denying",
    "without",
    "absent",
    "free of",
    "rules out",
    "ruled out",
    "declines",
    "declined",
    "refused",
    "no",
    "not",
    "never"
  ].map((l, i) => rule(`negation.fwd.${i}`, l, "negation", "forward")),

  // Backward: the thing, then the trigger. This is how a dental exam is
  // actually written — the finding is named and then cleared.
  ...[
    "is absent",
    "was absent",
    "not present",
    "not seen",
    "not noted",
    "was negative",
    "is negative",
    "unremarkable",
    "within normal limits",
    "wnl",
    "nad",
    "resolved",
    "asymptomatic"
  ].map((l, i) => rule(`negation.bwd.${i}`, l, "negation", "backward"))
];

// ---------------------------------------------------------------------------
// TERMINATORS. Typed by feature, per the published tables: "but" ends a
// negation scope; "patient"/"who"/"his"/"her" end a hypothetical or
// other-experiencer scope.
//
// "and" is deliberately NOT here. "No caries and no calculus" must stay
// negated across the conjunction.
// ---------------------------------------------------------------------------
const TERMINATORS: ContextRule[] = [
  ...["but", "however", "yet", "though", "although", "except", "aside from", "apart from", "otherwise", "nevertheless"].map(
    (l, i) => rule(`term.neg.${i}`, l, "negation", "terminate")
  ),
  ...["patient", "pt", "who", "his", "her", "their"].map((l, i) =>
    rule(`term.hyp.${i}`, l, "hypothetical", "terminate")
  ),
  ...["patient", "pt", "who", "his", "her", "their"].map((l, i) =>
    rule(`term.exp.${i}`, l, "experiencer", "terminate")
  )
];

// ---------------------------------------------------------------------------
// HISTORICAL and HYPOTHETICAL. Hints only — see the header.
// ---------------------------------------------------------------------------
const TEMPORAL: ContextRule[] = [
  ...["history of", "hx of", "h o", "in the past", "years ago", "months ago", "status post", "s p", "chronic", "long standing", "at last visit", "previously", "pre existing"].map(
    (l, i) => rule(`historical.${i}`, l, "historical", "forward")
  ),
  // Scope-limited to one term, per the published treatment of "previous".
  rule("historical.previous", "previous", "historical", "forward", 1),
  rule("historical.prior", "prior", "historical", "forward", 1),
  rule("historical.existing", "existing", "historical", "forward", 2),
  rule("historical.old", "old", "historical", "forward", 1),

  ...["if", "should", "unless", "in case of", "in the event", "will need", "may need", "plan to", "plan for", "recommend", "recommended", "consider", "return if", "watch for", "monitor for", "as needed for", "prn", "possible", "possibly", "suspect", "suspected", "rule out", "r o", "would"].map(
    (l, i) => rule(`hypothetical.${i}`, l, "hypothetical", "forward")
  )
];

const EXPERIENCER: ContextRule[] = [
  ...["family history of", "family history", "fh", "mother", "father", "sister", "brother", "son", "daughter", "parent", "guardian", "spouse", "husband", "wife", "mother's", "father's"].map(
    (l, i) => rule(`experiencer.${i}`, l, "experiencer", "forward")
  )
];

// Ordered longest-literal-first so that longest match wins at any position.
// Pseudo rules sort ahead of same-length rules so they win ties.
const ALL_RULES: ContextRule[] = [...PSEUDO, ...NEGATION, ...TERMINATORS, ...TEMPORAL, ...EXPERIENCER].sort(
  (a, b) =>
    b.literal.length - a.literal.length ||
    (a.direction === "pseudo" ? -1 : 0) - (b.direction === "pseudo" ? -1 : 0)
);

export interface Match {
  rule: ContextRule;
  from: number;
  to: number;
}

/**
 * Words that block negation when they sit immediately before the target.
 *
 * NegEx has this rule and ConText dropped it, and the ConText paper's own error
 * analysis reports the false positives that resulted: "has not been on steroids
 * for HIS asthma" negates the asthma. A definite article or possessive marks
 * the concept as a known, existing thing being referred to, not as a finding
 * being denied.
 */
const DEFINITE = new Set(["the", "his", "her", "their", "its", "this", "that", "these", "those"]);

/** Apostrophes are punctuation to the tokenizer, so comparison ignores them. */
const bare = (s: string): string => s.replace(/['\u2019]/g, "");

/**
 * Rules bucketed by their first token, longest literal first inside a bucket.
 *
 * MEASURED, not assumed. Profiling the extractor on a loaded note put 75% of
 * its runtime in this function, because the shape it replaces scanned all ~150
 * rules across every position of every clause. Most words begin no rule at all,
 * and a Map lookup that misses is the cheapest possible way to learn that.
 *
 * Built once at module load. The buckets inherit ALL_RULES' longest-first
 * ordering, which is what makes "no evidence of" win over "no" and keeps the
 * pseudo-rule tie-break that stops "no increase" being beaten by an
 * equal-length trigger.
 */
const RULES_BY_FIRST_TOKEN: Map<string, ContextRule[]> = (() => {
  const index = new Map<string, ContextRule[]>();
  for (const rule of ALL_RULES) {
    const key = bare(rule.literal[0]);
    const bucket = index.get(key);
    if (bucket) bucket.push(rule);
    else index.set(key, [rule]);
  }
  return index;
})();

/**
 * Find every rule match inside a token range.
 *
 * EXPORTED so a caller can compute it ONCE PER CLAUSE. It used to be called
 * from inside `assertionFor`, so a clause containing five facts scanned the
 * same tokens five times, and the extractor runs inside the per-keystroke
 * audit.
 *
 * Leftmost-longest: positions are visited in order and the longest rule
 * starting at each unconsumed position wins. That is the standard lexing
 * discipline, and it is what the previous longest-rule-first scan was
 * approximating.
 */
export function findMatches(tokens: Token[], from: number, to: number): Match[] {
  const matches: Match[] = [];
  const consumed = new Set<number>();
  for (let i = from; i < to; i++) {
    if (consumed.has(i)) continue;
    const candidates = RULES_BY_FIRST_TOKEN.get(bare(tokens[i].lower));
    if (!candidates) continue;
    for (const r of candidates) {
      const len = r.literal.length;
      if (i + len > to) continue;
      let ok = true;
      for (let k = 1; k < len; k++) {
        if (bare(tokens[i + k].lower) !== bare(r.literal[k])) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let k = 0; k < len; k++) consumed.add(i + k);
      matches.push({ rule: r, from: i, to: i + len });
      break;
    }
  }
  return matches;
}

/**
 * Decide the assertion for a target occupying token indices [targetFrom,
 * targetTo) inside the clause [from, to).
 */
export function assertionFor(
  tokens: Token[],
  clause: { from: number; to: number },
  targetFrom: number,
  targetTo: number,
  /** Precomputed clause matches. Recomputed when omitted, for callers with one target. */
  precomputed?: Match[]
): Assertion {
  const matches = precomputed ?? findMatches(tokens, clause.from, clause.to);
  const result: Assertion = { polarity: "affirmed", experiencer: "patient" };

  const asTrigger = (m: Match): Trigger => ({
    text: tokens.slice(m.from, m.to).map((t) => t.text).join(" "),
    span: { start: tokens[m.from].start, end: tokens[m.to - 1].end },
    ruleId: m.rule.id
  });

  const blockedByDefinite =
    targetFrom > clause.from && DEFINITE.has(tokens[targetFrom - 1].lower.replace(/['’]/g, ""));

  for (const m of matches) {
    if (m.rule.direction === "pseudo" || m.rule.direction === "terminate") continue;
    // A trigger that overlaps the target is not modifying it.
    if (m.from < targetTo && m.to > targetFrom) continue;

    const before = m.to <= targetFrom;
    const applies =
      m.rule.direction === "bidirectional" ||
      (m.rule.direction === "forward" && before) ||
      (m.rule.direction === "backward" && !before);
    if (!applies) continue;

    // Scope: distance in tokens, and nothing of the same category may
    // terminate in between.
    const gapFrom = before ? m.to : targetTo;
    const gapTo = before ? targetFrom : m.from;
    const distance = gapTo - gapFrom;
    if (m.rule.maxScope !== undefined && distance > m.rule.maxScope) continue;
    const terminated = matches.some(
      (t) =>
        t.rule.direction === "terminate" &&
        t.rule.category === m.rule.category &&
        t.from >= gapFrom &&
        t.to <= gapTo
    );
    if (terminated) continue;

    if (m.rule.category === "negation") {
      if (blockedByDefinite) continue;
      result.polarity = "negated";
      result.trigger = asTrigger(m);
    } else if (m.rule.category === "experiencer") {
      result.experiencer = "other";
      if (!result.trigger) result.trigger = asTrigger(m);
    } else if (!result.temporalityHint) {
      result.temporalityHint = m.rule.category === "historical" ? "historical" : "hypothetical";
      if (!result.trigger) result.trigger = asTrigger(m);
    }
  }

  return result;
}
