// What a rewrite is ALLOWED to introduce.
//
// The grounding check refuses output containing clinical words the input never
// contained. That rule needs one exception, and exactly one: the practice's own
// standard vocabulary. When the writer types "x-ray" and the model returns
// "radiograph", the word "radiograph" is new to the note and entirely
// legitimate — it is the replacement the audit engine is at that moment
// demanding. The same goes for every shorthand expansion and every spelling
// correction.
//
// DERIVED, NEVER RETYPED, for the reason wordMap.ts states about itself: a
// hand-maintained copy of a rule is a copy that drifts, and a verifier that
// disagrees with the transformer it guards would refuse the transformer's own
// correct output. Every entry here comes out of the tables the deterministic
// pass already enforces, so adding a standard word in one place teaches this
// module about it for free.

import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { SHORTHAND } from "@/lib/vocab/shorthand";
import { MEDICATION_WORDS, MISSPELLINGS } from "@/lib/vocab/misspellings";
import { PLAIN_WORDS } from "@/lib/vocab/plain-language";
import { SURFACE_NAMES } from "@/lib/vocab/surfaces";
import { stem, words } from "./normalize";

/**
 * Purely SYNTACTIC words — grammar, never a claim.
 *
 * The hard part of this list is what it must NOT contain. Every clinically or
 * legally loaded verb belongs on the other side of the wall: "discussed",
 * "reviewed", "tolerated", "obtained", "examined", "verified" all read like
 * ordinary English and all assert that something happened. The red-team case
 * that mattered most was a model appending "Risks and alternatives were
 * discussed and consent was obtained." to a note about an extraction — six
 * innocuous-looking words that decide a deposition. So this list is articles,
 * prepositions, conjunctions, pronouns, and the copula. Nothing that can be the
 * main verb of a clinical assertion.
 */
const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  // articles and determiners
  "a", "an", "the", "this", "that", "these", "those", "each", "every", "both",
  "all", "any", "some", "another", "other", "such", "same",
  // pronouns
  "i", "it", "its", "he", "him", "his", "she", "her", "hers", "they", "them",
  "their", "theirs", "we", "us", "our", "you", "your", "who", "whom", "whose",
  "which", "what", "there", "here",
  // copula and auxiliaries. "be" carries no claim of its own; the predicate
  // after it does, and the predicate has to be grounded.
  "is", "are", "was", "were", "be", "been", "being", "am",
  "has", "have", "had", "do", "does", "did",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  // prepositions and conjunctions
  "of", "in", "on", "at", "to", "for", "with", "from", "by", "as", "into",
  "onto", "over", "under", "about", "after", "before", "during", "through",
  "between", "across", "along", "against", "toward", "towards", "within",
  "and", "or", "but", "if", "then", "than", "because", "while", "when",
  "where", "whether", "so", "also", "however", "therefore", "thus",
  // ordinals and quantity words that qualify rather than assert. A count that
  // matters is a digit, and digits are compared exactly and separately.
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "today", "todays"
]);

/**
 * The SOAP capability's own section headings.
 *
 * The structure pass is instructed to emit these exact words as headings, so
 * they are output the model is supposed to add. Kept as a named constant rather
 * than folded into the function words, because they are not grammar — they are
 * this application's vocabulary, and if the prompt's heading list changes this
 * is the line that has to change with it.
 */
export const SOAP_HEADINGS: readonly string[] = [
  "safety",
  "subjective",
  "objective",
  "assessment",
  "plan"
];

/**
 * Stems that are pure grammar. The ONLY thing permitted unconditionally.
 *
 * The first version of this module had a flat allowlist: function words plus the
 * replacement side of every vocabulary table, permitted always. The invariant
 * test below immediately found ten holes in it — "reviewed", "verified",
 * "checked", "examined", "observed", "allergy", "scaling", "probing", "signs",
 * "limits" were all unconditionally introducible, because somewhere in the
 * tables a rule expands to each of them. A model could therefore assert "history
 * reviewed" or "no known allergies" about a note that said neither, and the
 * fabrication guard's first tier would wave it through.
 *
 * Removing them was not an option: "SRP" legitimately expands to "scaling and
 * root planing", and "NKA" to "no known allergies". Both are correct output.
 *
 * So the model is wrong, not the word list. A standardization is licensed BY ITS
 * TRIGGER: "scaling" may appear because the writer typed SRP, and for no other
 * reason. licenseFor() below resolves that per input, which closes the whole
 * class instead of ten instances of it.
 */
export const SYNTACTIC_STEMS: ReadonlySet<string> = new Set(
  [...FUNCTION_WORDS, ...SOAP_HEADINGS].map(stem)
);

interface Standardization {
  /** Matches the non-standard form as the writer would have typed it. */
  pattern: RegExp;
  /** Stems the standard replacement is allowed to introduce. */
  introduces: string[];
  /** Stems of the trigger itself, which the replacement consumes. */
  consumes: string[];
}

function stemsOf(phrase: string): string[] {
  return words(phrase).map(stem);
}

// Declared ABOVE the table that consumes it. `const` bindings are hoisted but
// not initialized, so a module-level IIFE reaching forward to one below it
// throws at import time rather than reading undefined — which is the better
// failure, and how this ordering bug surfaced immediately.
const DRUG_STEMS: ReadonlySet<string> = new Set([...MEDICATION_WORDS].map(stem));

function isDrugStem(s: string): boolean {
  return DRUG_STEMS.has(s);
}

/**
 * Every standardization the deterministic pass can perform, as trigger and
 * consequence.
 *
 * Derived from the four living tables. A drug name is filtered out of the
 * consequence side wherever it appears, because the application's own spelling
 * rule holds that "a clinician verifies the drug against the source record
 * before any correction" — the transformer never performs that edit, so the
 * verifier must never license it.
 */
const STANDARDIZATIONS: readonly Standardization[] = (() => {
  const rules: Standardization[] = [];
  const add = (
    pattern: RegExp,
    replacement: string,
    trigger: string,
    opts: { allowDrugNames: boolean } = { allowDrugNames: true }
  ) => {
    const introduces = opts.allowDrugNames
      ? stemsOf(replacement)
      : stemsOf(replacement).filter((s) => !isDrugStem(s));
    if (introduces.length === 0) return;
    // Case-insensitive, always. The deterministic pass keeps its own casing
    // rules — quadrant shorthand is uppercase-only there, deliberately, because
    // auto-replacing a lowercase "ul" could rewrite a typo into an anatomical
    // site. That caution is about APPLYING a change unasked. A license is a
    // different question: a model expanding "ul quad" to "upper left quadrant"
    // for a human to read is grounded in something the note actually says, and
    // refusing it made four of five realistic rewrites fail on site-changed.
    const insensitive = new RegExp(
      pattern.source,
      pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`
    );
    rules.push({ pattern: insensitive, introduces, consumes: stemsOf(trigger) });
  };

  for (const a of BANNED_ABBREVIATIONS) {
    // A "review" entry's `replacement` is GUIDANCE, not a replacement — "mod"
    // reads "moderate, or the mesial-occlusal-distal (MOD) surfaces — write
    // which". Licensing its words would license both readings of an ambiguity
    // the tool exists to refuse to guess at, plus every word of the advice
    // prose. The deterministic pass never applies these, so neither may a model.
    if (a.severityClass !== "style") continue;
    add(a.pattern, a.replacement, a.display);
  }
  for (const s of SHORTHAND) {
    // First-use convention writes the full term with the initialism after it in
    // parentheses, so the display form is part of the standard output too.
    add(s.pattern, `${s.expansion} ${s.display}`, s.display);
    if (s.pluralExpansion) add(s.pattern, s.pluralExpansion, s.display);
  }
  for (const [wrong, correction] of Object.entries(MISSPELLINGS)) {
    // The ONE source that may not license a drug name. An explicit shorthand
    // ("epi" -> "epinephrine") names a drug the writer already wrote; a spelling
    // correction GUESSES which drug they meant, and the practice's rule is that
    // a medication typo waits for a clinician to check the source record.
    add(
      new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
      correction,
      wrong,
      { allowDrugNames: false }
    );
  }
  for (const p of PLAIN_WORDS) add(p.pattern, p.replacement, p.display);
  // Surface names, so "MOD" may be written out as mesial/occlusal/distal.
  for (const [code, name] of Object.entries(SURFACE_NAMES)) {
    add(new RegExp(`\\b[MODBFLIP]*${code}[MODBFLIP]*\\b`, "g"), name, code);
  }
  return rules;
})();

export interface VocabularyLicense {
  /**
   * Stems this input licenses the output to introduce: grammar, plus the
   * consequence of every standardization whose trigger the input actually
   * contains.
   */
  licensed: ReadonlySet<string>;
  /**
   * Everything above PLUS the triggers themselves — the words a standardization
   * consumes.
   *
   * Used where input and output content are compared directly rather than one
   * being checked against the other. Expanding "NKA" to "no known allergies"
   * legitimately changes what the word "no" applies to, and a comparison that
   * could not see past the expansion would report that as an inverted negation.
   */
  noise: ReadonlySet<string>;
}

/**
 * What THIS input licenses. Computed per call.
 *
 * Runs every trigger pattern against the text, which sounds expensive and is
 * not: this is the AI-assist path, one call per deliberate click, not the
 * per-keystroke audit. Correctness is worth more here than microseconds.
 */
export function licenseFor(input: string): VocabularyLicense {
  const licensed = new Set<string>(SYNTACTIC_STEMS);
  const noise = new Set<string>(SYNTACTIC_STEMS);
  for (const rule of STANDARDIZATIONS) {
    rule.pattern.lastIndex = 0;
    const matched = input.match(rule.pattern);
    rule.pattern.lastIndex = 0;
    if (!matched) continue;
    for (const s of rule.introduces) {
      licensed.add(s);
      noise.add(s);
    }
    for (const s of rule.consumes) noise.add(s);
    // The trigger AS ACTUALLY WRITTEN, not only in its canonical form. Several
    // patterns match variants their `display` does not name — /\bBWX?\b/ matches
    // "BWX" while the display is "BW", /\bFM[XS]\b/ matches "FMS" — so a note
    // saying "bwx" kept "bwx" in every comparison while the expanded output did
    // not, and the negation-scope check read that as a negation covering
    // something different. Matching gives the real token for free.
    for (const m of matched) for (const w of words(m)) noise.add(stem(w));
  }
  return { licensed, noise };
}

/**
 * Every stem ANY standardization could ever introduce, regardless of input.
 *
 * Not used by the checks — they use licenseFor() — but asserted against in
 * vocabulary.test.ts, which is where it earns its place: it lets a test prove no
 * drug name is licensable by any rule at all, rather than only by the rules some
 * particular test input happens to trigger.
 */
export const EVER_LICENSABLE_STEMS: ReadonlySet<string> = new Set(
  STANDARDIZATIONS.flatMap((r) => r.introduces)
);

/**
 * Words whose fabrication is the most damaging thing this verifier can miss.
 *
 * The grounding check has two tiers, and this is tier one. A word here that
 * appears in the output and nowhere in the input is refused on its own, without
 * needing the surrounding sentence to look invented — because a single
 * fabricated "consent" or "uneventful" or "tolerated" is exactly the sentence a
 * plaintiff's expert reads aloud. These are ordinary English, which is precisely
 * why the ordinary-English function-word list cannot be allowed to cover them.
 *
 * Every one of these is a claim about something that HAPPENED or a judgement
 * about how it turned out. None can be inferred from a note that does not say
 * it.
 */
export const LOADED_ASSERTIONS: ReadonlySet<string> = new Set(
  [
    // consent and disclosure — the deposition words
    "consent", "consented", "consents", "informed", "disclosed", "disclosure",
    "risks", "risk", "benefits", "alternatives", "discussed", "discussion",
    "counseled", "counselled", "educated", "explained", "advised", "instructed",
    "witnessed", "signed", "authorized", "authorised", "refused", "declined",
    "agreed", "acknowledged",
    // outcome and normalcy claims
    "tolerated", "uneventful", "uncomplicated", "complication", "complications",
    "normal", "limits", "unremarkable", "negative", "stable", "healed",
    "healthy", "asymptomatic", "afebrile", "wnl", "successful", "successfully",
    "resolved", "improved", "comfortable", "painless", "atraumatic",
    // verification and review claims
    "reviewed", "verified", "confirmed", "checked", "rechecked", "reassessed",
    "evaluated", "examined", "inspected", "palpated", "percussed", "probed",
    "tested", "screened", "measured", "monitored", "observed", "documented",
    "updated",
    // procedural claims
    "anesthetized", "anaesthetized", "sterile", "sterilized", "isolated",
    "administered", "dispensed", "prescribed", "injected", "irrigated",
    "sutured", "extracted", "restored", "adjusted", "polished", "scaled",
    "referred", "cleared", "discharged", "scheduled", "completed", "performed",
    // safety-critical states
    "allergy", "allergies", "allergic", "contraindicated", "contraindication",
    "pregnant", "pregnancy", "anticoagulated", "bisphosphonate", "bisphosphonates"
  ].map(stem)
);
