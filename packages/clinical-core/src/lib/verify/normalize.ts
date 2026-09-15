// Text normalization for the meaning verifier.
//
// Every check downstream compares what the model wrote against what the writer
// typed. That comparison is only as good as the tokenizer feeding it, and the
// red-team probe showed the tokenizer was the softest part of the wall: a
// fabricated dose written in Arabic-Indic digits (٥٠٠) and a fabricated tooth
// number written in fullwidth digits (１９) both walked straight through, because
// JavaScript's \d matches ASCII only. The output "gained" no digits as far as
// the digit check could see, so the digit check had nothing to compare.
//
// A denylist of confusable characters is unwinnable — the audit engine already
// learned that lesson about invisible characters and wrote it down. So this
// folds the text to one canonical form FIRST and lets every check run against
// that, rather than teaching each check about Unicode separately.

import { visibleText } from "@/lib/audit/attestation";
import { foldDigits } from "@/lib/text/foldDigits";

/**
 * Fold text to the form every check compares against.
 *
 * NFKC does the heavy lifting: it maps fullwidth Latin and digits, ligatures,
 * and most compatibility forms onto their ASCII equivalents. `visibleText`
 * strips the zero-width and format characters NFKC leaves alone — reused rather
 * than reimplemented so the verifier and the PHI attestation validator can never
 * disagree about what "renders" means. The digit pass afterwards catches the
 * decimal scripts NFKC does NOT fold, which is all of them: NFKC preserves
 * ٥ and ५ and ๕ exactly as they are, because they are not compatibility
 * characters — they are different digits that mean the same number.
 */
export function canonical(text: string): string {
  return foldToothHash(foldNumberWords(spaceUnits(foldDigits(visibleText(text.normalize("NFKC"))))));
}

/**
 * Separate a measurement from its unit: "400mg" becomes "400 mg".
 *
 * The unit check is `\b(?:mg|mL|mm|…)\b`, and there is no word boundary between
 * "0" and "m" — so a glued unit is invisible to it. That produced a refusal on
 * every rewrite that did the RIGHT thing: the note said "ibuprofen 400mg", the
 * model returned "ibuprofen 400 mg", the verifier saw units go from [] to [mg]
 * and called it a changed measurement. Un-gluing is precisely what the
 * standardizer's own spaceUnits() does, so the verifier was refusing the house
 * style.
 *
 * Deliberately the same bounded unit list the standardizer uses, so a tooth
 * designation or a date is never split.
 */
function spaceUnits(text: string): string {
  return text.replace(/\b(\d+(?:\.\d+)?)(mg|mcg|kg|mL|ml|mm|cm|g)\b/g, "$1 $2");
}

/**
 * "#17" and "tooth 17" are the same designator written two ways.
 *
 * Writing the word out is one of the most valuable things the transformer does —
 * "#17" means nothing to a reader outside dentistry, and a records request goes
 * to exactly such a reader. But it introduces the word "tooth", which the
 * grounding check then could not trace to anything in the note, so a correct
 * rewrite was refused for inventing content. Folding both notations to one makes
 * them comparable without licensing anything new.
 */
function foldToothHash(text: string): string {
  return text.replace(/#\s?(\d{1,2}\b)/g, "tooth $1");
}

// Small integers written as words. A quantity is a quantity however it is
// notated, which is the same principle that folds ٥ onto 5.
const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
  seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12"
};

/**
 * Fold a spelled-out small integer onto its digit.
 *
 * "1 carpule" becoming "One carpule" at the start of a sentence is one of the
 * most natural things a language model does, and it refused the whole rewrite
 * for `digits-changed` — a false alarm about a number that had not changed.
 *
 * Bounded at twelve, and single words only, which is what keeps it safe: a model
 * turning "500 mg" into "five hundred mg" still fails, because "hundred" is not
 * in this table and the digits then genuinely disagree. Folding is applied to
 * both sides of every comparison, so it can never manufacture a match that the
 * quantities do not support.
 */
function foldNumberWords(text: string): string {
  return text.replace(/\b[A-Za-z]+\b/g, (w) => NUMBER_WORDS[w.toLowerCase()] ?? w);
}

/**
 * Map every Unicode decimal digit onto its ASCII counterpart.
 *
 * \p{Nd} is the whole Number/decimal-digit category, so this covers Arabic
 * Indic, Devanagari, Thai, Bengali, fullwidth and the rest without naming any
 * of them. The value of a decimal digit is its offset from the zero of its own
 * block, and codePointAt arithmetic recovers that without a lookup table.
 */

/**
 * Lowercased alphabetic tokens. Digits are compared separately and exactly.
 *
 * Hyphens and apostrophes are SEPARATORS, not part of a token. They used to be
 * included, which meant "follow-up" tokenized as one word while the model's
 * "follow up" tokenized as two — so the licensed expansion of "f/u" could not
 * ground the output, and a correct rewrite was refused for inventing content.
 * Splitting both sides the same way is what makes the comparison mean anything.
 */
export function words(text: string): string[] {
  return canonical(text).toLowerCase().match(/[a-z]+/g) ?? [];
}

/**
 * A crude stem, so "restore" / "restored" / "restoring" / "restoration" all
 * compare equal.
 *
 * Deliberately not a real stemmer. The grounding check asks "did this word come
 * from somewhere", and for that question over-stemming is safe (it grounds a
 * word that was already close to a real one) while under-stemming produces
 * false alarms on ordinary grammar fixes. The same suffix-stripping shape the
 * spelling rule already uses, kept in step with it on purpose.
 */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/['-]/g, "");
  for (const suffix of ["ations", "ation", "ings", "ing", "ies", "ied", "ees", "ed", "es", "s", "ly"]) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  // "restor" from restoration and "restore" from restored must meet.
  return w.replace(/e$/, "");
}

export function stems(text: string): Set<string> {
  return new Set(words(text).map(stem));
}

/**
 * Split into the clauses a claim can live in.
 *
 * Sentence terminators AND the internal punctuation that separates independent
 * assertions, because "No swelling; tenderness present" is two claims and the
 * negation-scope check has to see the semicolon or it will read the negation as
 * covering both.
 */
export function clauses(text: string): string[] {
  return canonical(text)
    .split(/(?<=[.!?])\s+|[;:\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
