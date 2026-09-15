import type { AuditFinding } from "../types";
import { DENTAL_LEXICON } from "@/lib/vocab/lexicon-dental";
import { COMMON_LEXICON } from "@/lib/vocab/lexicon-common";
import { GENERATED_LEXICON } from "@/lib/vocab/lexicon-generated";
import { MEDICATION_WORDS, MISSPELLINGS } from "@/lib/vocab/misspellings";

// Safe-edit boundary: a medication-name typo stays S2 REVIEW until a
// clinician verifies the source. Other high-confidence typos are S3 STYLE.
// Unknown words are S4 INFO only — the office lexicon cannot know every word.

const MAX_UNKNOWN_WORD_FINDINGS = 15;

// The close-match scan (Levenshtein against the dental lexicon) is the one
// expensive step: ~55µs per unknown word. A shared budget bounds the total
// work per audit run, so a note stuffed with unique junk words degrades to
// "no close-match suggestions" instead of blocking the event loop. Set-based
// lexicon lookups stay unbudgeted — they are O(1).
export interface SpellingBudget {
  closeChecks: number;
}

export const DEFAULT_CLOSE_CHECKS = 1500;

export function newSpellingBudget(): SpellingBudget {
  return { closeChecks: DEFAULT_CLOSE_CHECKS };
}

function inAnyLexicon(word: string): boolean {
  return DENTAL_LEXICON.has(word) || COMMON_LEXICON.has(word) || GENERATED_LEXICON.has(word);
}

function known(word: string): boolean {
  if (inAnyLexicon(word)) return true;
  // Naive plural/verb endings. "d" handles the -ed form of an e-ending stem
  // ("suture" -> "sutured"); for "ed"/"ing" we also restore the dropped "e"
  // ("suture" -> "suturing") so common verb forms are not flagged as typos.
  for (const suffix of ["s", "es", "ed", "ing", "ly", "d"]) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    if (stem.length < 3) continue;
    if (inAnyLexicon(stem)) return true;
    if ((suffix === "ed" || suffix === "ing") && inAnyLexicon(stem + "e")) return true;
  }
  return false;
}

function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    let rowMin = dp[0];
    for (let i = 1; i <= a.length; i++) {
      const cur = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
      rowMin = Math.min(rowMin, dp[i]);
    }
    if (rowMin > max) return false;
  }
  return dp[a.length] <= max;
}

function computeCloseDentalTerm(word: string): string | undefined {
  const max = word.length >= 8 ? 2 : 1;
  for (const term of DENTAL_LEXICON) {
    if (term.length >= 5 && editDistanceAtMost(word, term, max)) return term;
  }
  return undefined;
}

/**
 * Memoized close-match lookup — the single hottest thing in the whole app.
 *
 * The scan runs Levenshtein against all 394 dental terms of length >= 5, and
 * the budget below permits 1,500 of those per audit run. runAudit() runs on
 * EVERY KEYSTROKE in the builder, and measured on a developer machine this one
 * function was 79-81% of the entire per-keystroke pipeline: 46 ms of the 58 ms
 * for a fully loaded note, 11 ms of 14 ms for a typical one. A clinician's
 * tablet is several times slower than that machine, which is where those
 * numbers stop being a profile and start being visible lag between a key going
 * down and the letter appearing.
 *
 * Almost all of that work was repeated. The function is pure and the lexicon is
 * a static table, so a word's close match never changes — yet it was recomputed
 * once per field that contains the word, and then again for every field on the
 * next keystroke. Caching turns the second occurrence of any word, in any field,
 * on any later keystroke, into a Map lookup.
 *
 * Two properties this must not break, both pinned in spelling.test.ts:
 *
 *   - The budget is still spent at the CALL SITE, on every attempt, hit or
 *     miss. Charging only cache misses would make the report depend on how warm
 *     the cache happened to be, so the same note could audit differently in two
 *     server processes — and a frozen audit report has to be a fact about the
 *     note, not about the machine that graded it.
 *   - Findings are byte-identical to the uncached implementation. This is a
 *     cache of a pure function, not a change to a rule.
 *
 * Bounded because a server process is long-lived and words arrive from typed
 * text. Cleared wholesale rather than evicted by age: correctness does not
 * depend on any entry surviving, so the cheapest possible policy is the right
 * one.
 */
const CLOSE_MATCH_CACHE_MAX = 4096;
const closeMatchCache = new Map<string, string | undefined>();
let closeMatchScans = 0;

function closeDentalTerm(word: string): string | undefined {
  // `has` rather than a truthy check: "no close term" is a real answer worth
  // caching, and it is the common one.
  if (closeMatchCache.has(word)) return closeMatchCache.get(word);
  closeMatchScans++;
  const match = computeCloseDentalTerm(word);
  if (closeMatchCache.size >= CLOSE_MATCH_CACHE_MAX) closeMatchCache.clear();
  closeMatchCache.set(word, match);
  return match;
}

/**
 * Test-only instrumentation.
 *
 * `closeMatchScans` counts full 394-term Levenshtein sweeps — the actual
 * expensive work, as opposed to the wall-clock time it happens to take on
 * whatever machine CI gave us. A performance guard written against a work count
 * fails deterministically when the cache is removed or defeated; the same guard
 * written as a millisecond ceiling has to be set so loose (CI runners vary by
 * several times) that it would sit there green through the exact regression it
 * exists to catch. See spelling.test.ts and engine-keystroke.test.ts.
 */
export function __resetCloseMatchCache(): void {
  closeMatchCache.clear();
  closeMatchScans = 0;
}

export function __closeMatchScans(): number {
  return closeMatchScans;
}

export function runSpellingRule(
  text: string,
  fieldRef?: { moduleId: string; fieldId: string },
  budget: SpellingBudget = newSpellingBudget()
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const seen = new Set<string>();
  let unknownCount = 0;
  // Also capture ALL-CAPS words so a shouted medication typo ("AMOXICILIN")
  // still reaches the medication check. Their generic unknown-word finding is
  // suppressed below so ordinary acronyms (EDR, BWX, PARL) stay quiet.
  for (const m of text.matchAll(/[A-Za-z][A-Za-z']{2,}/g)) {
    const raw = m[0];
    const isAllCaps = raw.length >= 2 && raw === raw.toUpperCase();
    const word = raw.toLowerCase().replace(/'s?$/, "");
    if (word.length < 3 || seen.has(word)) continue;
    seen.add(word);

    const correction = MISSPELLINGS[word];
    if (correction) {
      const medication = MEDICATION_WORDS.has(correction);
      findings.push({
        ruleId: medication ? "spelling.medication" : "spelling.known-misspelling",
        category: "spelling",
        severity: medication ? "S2" : "S3",
        message: medication
          ? `"${raw}" looks like a misspelled medication name. A clinician verifies the drug against the source record before any correction.`
          : `"${raw}" looks misspelled.`,
        matchedText: raw,
        suggestion: correction,
        fieldRef
      });
      continue;
    }
    if (known(word)) continue;

    const close = budget.closeChecks > 0 ? (budget.closeChecks--, closeDentalTerm(word)) : undefined;
    if (close) {
      const medication = MEDICATION_WORDS.has(close);
      findings.push({
        ruleId: medication ? "spelling.medication" : "spelling.close-match",
        category: "spelling",
        severity: medication ? "S2" : "S3",
        message: medication
          ? `"${raw}" is close to the medication name "${close}". A clinician verifies the drug against the source record before any correction.`
          : `"${raw}" may be a misspelling of "${close}".`,
        matchedText: raw,
        suggestion: close,
        fieldRef
      });
      continue;
    }

    if (!isAllCaps && word.length >= 5 && unknownCount < MAX_UNKNOWN_WORD_FINDINGS) {
      unknownCount++;
      findings.push({
        ruleId: "spelling.unknown-word",
        category: "spelling",
        severity: "S4",
        message: `"${raw}" is not in the office word list. Check the spelling.`,
        matchedText: raw,
        fieldRef
      });
    }
  }
  return findings;
}
