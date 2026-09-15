// THE SHORTHAND FILING GATE — tiered, because not all shorthand is the same risk.
//
// ===========================================================================
// WHY THIS IS NOT A BLANKET BLOCK
//
// The obvious design is: find shorthand, refuse to file until the writer types
// it out. It is obvious, it is well-intentioned, and it would cost more than it
// buys, for three reasons.
//
// IT INVERTS THE PRODUCT'S PURPOSE. Shorthand exists because it is fast. A tool
// that refuses the note until every abbreviation is expanded by hand is slower
// than a blank text box, and the stated goal is to save staff time.
//
// IT ASKS A HUMAN TO DO WORK THE MACHINE ALREADY DID. The vocabulary tables
// already know "lido" is lidocaine and expand it deterministically. Making the
// writer type it out is the tool making a person do its job.
//
// IT FLATTENS THE SIGNAL THAT MATTERS. "BW" for bitewing is universal and
// harmless. "10U" for ten units has turned ten into a hundred. A gate that
// stops both teaches people to clear both with the same reflex, and the
// override arithmetic is brutal: drug-allergy alerts are overridden 87.6% of
// the time, and repeated alerts 12 points harder than first-time ones.
//
// SO THE GATE IS TIERED. Blocking is spent only where a machine genuinely
// cannot decide:
//
//   TIER 1  known and unambiguous   -> expanded automatically. No block, no
//                                      finding, no work. ("lido", "BW", "RCT")
//   TIER 2  ambiguous               -> BLOCKS. Only the writer knows which
//                                      meaning. ("CR", "GP", "mod")
//   TIER 3  unknown                 -> BLOCKS. Nobody can read it in five
//                                      years, including us.
//   TIER 4  do-not-use              -> BLOCKS, and is never expanded, because
//                                      expanding a dangerous abbreviation
//                                      launders it. ("qd", "U", "hs")
//
// Tiers 2-4 are S1: they stop FILING, which is the point at which the note
// becomes part of a record someone else will read. They deliberately do not
// stop copy or draft work, because a writer mid-note should not be fighting the
// tool over a word they are about to fix anyway.
// ===========================================================================

import type { AuditFinding } from "../types";
import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { SHORTHAND } from "@/lib/vocab/shorthand";
import { looksLikeShorthand } from "@/lib/vocab/unknownAbbreviations";
import { definedInText } from "./terminology";
import { MASK_TOKEN_PATTERN } from "../maskPhi";

/**
 * Tier 4. Do-not-use constructs, which block and are never expanded.
 */
function doNotUseFindings(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const abbr of BANNED_ABBREVIATIONS) {
    if (!abbr.doNotUse) continue;
    const seen = new Map<string, number>();
    abbr.pattern.lastIndex = 0;
    for (const m of text.matchAll(abbr.pattern)) seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    for (const [matched, count] of seen) {
      findings.push({
        ruleId: `gate.do-not-use.${abbr.id}`,
        category: "abbreviation",
        severity: "S1",
        message: `"${matched}" is on the do-not-use list because it is misread in practice. Write it out before filing.`,
        matchedText: matched,
        suggestion: abbr.replacement,
        occurrences: count
      });
    }
  }
  return findings;
}

/**
 * Tier 2. Shorthand with more than one real reading in a dental chart.
 *
 * This is the tier the whole design turns on. The tool cannot expand these —
 * guessing would put a clinical claim in the note the writer never made — and
 * it should not let them through either, because the ambiguity is permanent
 * once the note is filed. Only the person who was in the room can resolve it,
 * and the only moment they reliably still remember is now.
 */
function ambiguousFindings(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const sh of SHORTHAND) {
    if (!sh.alternatives || sh.alternatives.length === 0) continue;
    const seen = new Map<string, number>();
    sh.pattern.lastIndex = 0;
    for (const m of text.matchAll(sh.pattern)) seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    for (const [matched, count] of seen) {
      // Already written out with the shorthand in parentheses: the writer has
      // said which meaning, which is exactly what was being asked for.
      if (definedInText(text, matched)) continue;
      findings.push({
        ruleId: `gate.ambiguous.${sh.id}`,
        category: "abbreviation",
        severity: "S1",
        message: `"${matched}" has more than one meaning here: ${sh.alternatives.join("; ")}. Write the one you mean.`,
        matchedText: matched,
        suggestion: `Write the full term, then "${sh.display}" in parentheses if you want the shorthand afterwards.`,
        occurrences: count
      });
    }
  }
  return findings;
}

/**
 * Tier 3. Tokens that look like clinical shorthand and are in no table.
 *
 * The threshold for "looks like shorthand" is deliberately conservative — it is
 * the same predicate the practice-vocabulary counter uses, so a token cannot be
 * blocked here and simultaneously invisible to the process that would add it to
 * the tables. That symmetry matters: every block this tier raises has a route
 * out that makes the next occurrence free.
 */
function unknownFindings(text: string): AuditFinding[] {
  // THE TOOL'S OWN OUTPUT IS NOT THE WRITER'S SHORTHAND.
  //
  // A masked identifier is `[PERSON-A7K2]`, and `PERSON` and `A7K2` are both
  // capitalised, table-less, and exactly the shape this tier looks for. Left in,
  // the gate blocked filing on a note BECAUSE the tool had just redacted it —
  // punishing the one action it most wants people to take. Caught by
  // maskPhi.test.ts, which asserts that a masked note is actually fileable.
  //
  // Stripped structurally, using the mask pattern itself rather than a guess at
  // token shapes, for the same reason the vocabulary counter strips the
  // submission stamp by its delimiter: the pattern is a fact and a heuristic
  // would not survive the next mask format.
  const scannable = text.replace(MASK_TOKEN_PATTERN, " ");

  // Trailing digits are PART OF THE TERM. "ETCO2", "N2O", "CO2" and "A1c" are
  // single terms, and a pattern that stopped at the first digit reported "ETCO"
  // — a token nobody has ever written — as unreadable shorthand, while the real
  // term went unchecked. The letters-only pattern this replaces is still correct
  // for the vocabulary counter, which ranks what to ADD to the tables; here the
  // token has to be the thing a writer would have to fix.
  const seen = new Map<string, number>();
  for (const m of scannable.matchAll(/[A-Za-z][A-Za-z./]*[A-Za-z]\d*/g)) {
    const token = m[0];
    if (!looksLikeShorthand(token)) continue;
    seen.set(token, (seen.get(token) ?? 0) + 1);
  }
  const findings: AuditFinding[] = [];
  for (const [matched, count] of seen) {
    if (definedInText(text, matched)) continue;
    findings.push({
      ruleId: "gate.unknown-shorthand",
      category: "abbreviation",
      severity: "S1",
      message: `"${matched}" is not in the practice vocabulary, so nobody reading this later can be sure what it means.`,
      matchedText: matched,
      suggestion:
        "Write it out this once. If the practice uses it often, ask a Team Lead to add it to the vocabulary and it will expand by itself next time.",
      occurrences: count
    });
  }
  return findings;
}

/**
 * Every shorthand that must be resolved before this note is filed.
 *
 * Ordered do-not-use first, then ambiguous, then unknown: that is descending
 * order of how much a wrong reading costs, and the panel shows findings in the
 * order this returns them.
 */
export function runShorthandGate(text: string): AuditFinding[] {
  return [...doNotUseFindings(text), ...ambiguousFindings(text), ...unknownFindings(text)];
}
