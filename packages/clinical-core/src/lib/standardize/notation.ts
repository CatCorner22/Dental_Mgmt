// NOTATION NORMALIZATION: the deterministic passes that turn chart shorthand into
// something a reader outside dentistry can follow.
//
// These are separated from the vocabulary tables because they are not word
// substitutions — they are transformations of NOTATION, driven by shape rather
// than by a lookup. All of them are meaning-preserving by construction: "#14" and
// "tooth 14" designate the same tooth, "6mo" and "6 months" are the same interval.
//
// Why this file exists at all: a quality audit of real output found the
// transformer producing "Perc + on #14 ... reappoint 6mo. Nka." — half-standard
// text with the single most opaque construct in a dental note left untouched. A
// records request goes to an insurer, an attorney, or the next treating dentist,
// and "#14" means nothing to two of those three.

import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { SHORTHAND } from "@/lib/vocab/shorthand";

/**
 * ADA Universal permanent teeth are 1–32. Supernumerary permanents are 51–82.
 *
 * The range check is the whole safety story for the tooth pass. A note also
 * contains "Lot #4432" and "Op #2", and turning a lot number into a tooth would
 * be a falsified site. Out of range means it is not a tooth designator, so it is
 * left exactly as written.
 */
function isToothNumber(n: number): boolean {
  return (n >= 1 && n <= 32) || (n >= 51 && n <= 82);
}

/**
 * "#14" becomes "tooth 14"; "teeth #2, #3" becomes "teeth 2, 3".
 *
 * Clause-scoped, and that is what makes the output read properly. If the clause
 * already names a tooth ("extraction of tooth #17", "sealants on teeth #3 and
 * #14"), the hash is simply dropped — inserting the word again would produce
 * "teeth tooth 2, tooth 3". Only a clause with no tooth word gets the word added.
 *
 * A range is handled before single designators so "#2-#5" becomes "teeth 2-5"
 * rather than the nonsense "tooth 2-tooth 5".
 */
/**
 * Words that make a following "#N" something other than a tooth.
 *
 * The range check alone is not enough, and a browser audit proved it: "Op #2"
 * became "Op tooth 2", turning operatory two into a tooth. Operatory, lot, batch,
 * room, chair, claim and invoice numbers all live in the low integers exactly
 * where tooth numbers do, so the only discriminator is the word in front.
 */
const NOT_A_TOOTH_CONTEXT =
  /\b(?:op|operatory|room|chair|lot|batch|ref|reference|invoice|claim|acct|account|order|item|serial|model|shade|unit)\s*$/i;

export function expandToothHash(input: string): string {
  // The separator is CAPTURED and rejoined with "" rather than " ". Splitting on
  // newlines and joining with a space collapsed "- one\n- two" into "- one - two",
  // welding two list items — and paragraph breaks carry meaning in a clinical note
  // (one paragraph per phase of the visit), so losing them loses structure.
  return input
    .split(/((?<=[.!?])\s+|\n)/)
    .map((clause, i) => {
      if (i % 2 === 1) return clause; // a captured separator: pass through untouched
      if (!clause.includes("#")) return clause;
      const namesTooth = /\b(?:tooth|teeth)\b/i.test(clause);

      // Ranges first: "#2-#5", "#2 - 5", "#2 to #5".
      let out = clause.replace(
        /#\s?(\d{1,2})\s*(-|–|to|through)\s*#?\s?(\d{1,2})\b/gi,
        (m, a: string, sep: string, b: string) => {
          if (!isToothNumber(Number(a)) || !isToothNumber(Number(b))) return m;
          const joiner = /-|–/.test(sep) ? "-" : ` ${sep} `;
          return namesTooth ? `${a}${joiner}${b}` : `teeth ${a}${joiner}${b}`;
        }
      );

      // Then single designators, numeric and primary-letter.
      out = out.replace(/#\s?(\d{1,2})\b/g, (m, n: string, offset: number, whole: string) => {
        if (!isToothNumber(Number(n))) return m;
        if (NOT_A_TOOTH_CONTEXT.test(whole.slice(0, offset))) return m;
        return namesTooth ? n : `tooth ${n}`;
      });
      out = out.replace(/#\s?([A-T])\b/g, (m, letter: string, offset: number, whole: string) => {
        if (NOT_A_TOOTH_CONTEXT.test(whole.slice(0, offset))) return m;
        return namesTooth ? letter : `tooth ${letter}`;
      });
      return out;
    })
    .join("");
}

/**
 * Every short token the vocabulary tables can act on, for the un-gluing pass.
 *
 * Derived rather than listed, so an abbreviation added to a table is un-glued for
 * free. Bounded to tokens of six letters or fewer: those are the ones that get
 * typed hard against a number.
 */
const GLUEABLE: ReadonlySet<string> = new Set(
  [
    ...BANNED_ABBREVIATIONS.map((a) => a.display),
    ...SHORTHAND.map((s) => s.display),
    // Measurement units, which spaceUnits already separates during presentation.
    // Included here too so the separation happens BEFORE the vocabulary passes,
    // which is the whole point of this function.
    "mg", "mcg", "kg", "mL", "ml", "mm", "cm", "g", "hr", "hrs", "min", "sec"
  ]
    .map((d) => d.toLowerCase().replace(/[^a-z]/g, ""))
    .filter((d) => d.length >= 1 && d.length <= 6)
);

/**
 * Separate a number from an abbreviation typed hard against it: "6mo" -> "6 mo".
 *
 * This runs BEFORE the vocabulary passes, and that ordering is the fix. The
 * existing unit-spacing pass runs during PRESENTATION, after every substitution,
 * which is why "400mg" came out as "400 mg" (a unit needs no lookup) while "6mo"
 * came out as "6mo" — `\bmo\b` never matched, because there is no word boundary
 * between "6" and "m", so the months rule could not see it. Measured on a real
 * note: "reappoint 6mo" survived every pass untouched.
 *
 * Only splits when the trailing letters are a token some table actually knows.
 * "2carpules" is left alone, and — critically — "q6h" is never touched, because
 * the pattern anchors on a digit and the letters after "6" are "h", which is not
 * a glueable token. Splitting a dosing abbreviation would be far worse than
 * failing to expand one.
 */
export function separateGluedAbbreviations(input: string): string {
  return input.replace(/(\d)([A-Za-z]{1,6})\b/g, (m, digit: string, letters: string) => {
    if (!GLUEABLE.has(letters.toLowerCase())) return m;
    return `${digit} ${letters}`;
  });
}

/**
 * "x3 days" becomes "for 3 days".
 *
 * Bounded to a following time word, which is what keeps it safe: "x3" in front of
 * "days" is a duration, and "2 x 4 mm" is a dimension. Without the time word this
 * pass does nothing, so a measurement can never be rewritten as a duration.
 */
export function expandDurationX(input: string): string {
  return input.replace(
    /\bx\s?(\d+(?:\.\d+)?)\s+(days?|weeks?|months?|years?|hours?|hrs?|mins?|minutes?)\b/gi,
    (_m, n: string, unit: string) => `for ${n} ${unit}`
  );
}

/**
 * Canonical casing for the initialisms the tables know.
 *
 * The sentence-caser uppercases the first letter after a terminator, which turned
 * a sentence-initial "nka." into "Nka." — an initialism written in title case,
 * which reads as a typo and undermines the one thing this tool claims to do.
 * Applied AFTER sentence casing, and only to tokens whose canonical form the
 * tables define, so it can never invent a capitalisation of its own.
 *
 * Ambiguous entries benefit most: they are deliberately never expanded, so their
 * shorthand is what stays in the note and its casing is all the reader gets.
 */
/**
 * Initialisms whose canonical casing must NOT be restored, because for these the
 * capitalisation IS the disambiguation.
 *
 * A bug this file introduced and a browser audit caught within minutes: a
 * sentence-initial "mod composite" was sentence-cased to "Mod" and then "restored"
 * to "MOD" — which silently picked the mesial-occlusal-distal reading of a token
 * the tool deliberately refuses to guess at, and asserted a billed surface the
 * writer never named. Casing is not cosmetic when a reading depends on it.
 *
 * The test is not "is this ambiguous" — NKA is ambiguous and safe, because both of
 * its readings are written NKA. The test is whether the LOWER-CASE form is a
 * different real word: "mod" is moderate, "temp" is temporary, "cal" is calculus,
 * "ext" is external, "tad" is an ordinary English word, and "Coe" and "Zoe" are
 * names — Coe-Pak among them.
 *
 * No lexicon can decide this list: COMMON_LEXICON is a curated clinical word list,
 * not an English dictionary, and it contains none of these. So it is explicit, and
 * collisions.test.ts carries a sentence starting with each one to prove they come
 * back untouched.
 */
const CASE_MUST_NOT_DISAMBIGUATE: ReadonlySet<string> = new Set([
  "mod",
  "cal",
  "temp",
  "imp",
  "ext",
  "tad",
  "coe",
  "zoe"
]);

const CANONICAL_CASE: ReadonlyMap<string, string> = new Map(
  [...SHORTHAND.map((s) => s.display), ...BANNED_ABBREVIATIONS.map((a) => a.display)]
    // Only single-token, all-caps initialisms. A lower-case display like "pt" or
    // "c/o" is meant to be lower case, and a multi-word display is guidance text
    // rather than something that appears in a note.
    .filter((d) => /^[A-Z][A-Z0-9]*$/.test(d))
    .filter((d) => !CASE_MUST_NOT_DISAMBIGUATE.has(d.toLowerCase()))
    .map((d) => [d.toLowerCase(), d] as const)
);

export function restoreInitialismCase(input: string): string {
  return input.replace(/\b[A-Za-z]{2,6}\b/g, (word) => {
    const canonical = CANONICAL_CASE.get(word.toLowerCase());
    if (!canonical) return word;
    // Only fix a word that is already trying to be the initialism: all-caps is
    // already right, and a fully lower-case token may be an ordinary word the
    // vocabulary happens to collide with ("mod", "cal", "la").
    return /^[A-Z][a-z]+$/.test(word) ? canonical : word;
  });
}

/**
 * A leading section label gets a colon: "Dx irreversible pulpitis" becomes
 * "Diagnosis: irreversible pulpitis".
 *
 * Only these labels, only at the start of a sentence, and only when a colon is
 * not already there. "Diagnosis irreversible pulpitis" is not a sentence in any
 * register, and the colon is what makes the line scannable to whoever is reading
 * fifty notes.
 */
/**
 * Deliberately short. "History", "Treatment", "Medical history" and "Review of
 * systems" were here and are gone, because each is an ordinary noun phrase far
 * more often than a label: the idempotency property test caught "History of
 * present illness (HPI) recorded" being turned into "History: of present illness",
 * a colon dropped into the middle of a phrase.
 *
 * What is left are the words that, at the start of a sentence and followed by
 * substance, really are section headers — and they are exactly the ones the
 * abbreviation table produces from dx, cc and plan.
 */
/**
 * Two. "Objective", "Subjective", "Assessment" and "Plan" were here and are gone,
 * because they are all ordinary English adjectives or nouns — "Objective findings
 * were recorded" got a colon dropped into it, and no stop-list of following words
 * fixes that class, it only postpones it.
 *
 * What is left cannot be an adjective. A sentence-initial "Diagnosis" or "Chief
 * complaint" followed by substance is a label with its colon missing, essentially
 * always, and both are exactly what the abbreviation table produces from dx and cc.
 *
 * Real sectioning is not this pass's job. structure.ts groups sentences under
 * proper SOAP headings, which is the correct answer to "this note needs sections"
 * and does not require guessing whether a word is a label.
 */
const SECTION_LABELS = ["Diagnosis", "Chief complaint"];

/**
 * Words that mean the label is part of a phrase rather than heading one.
 *
 * "Plan for the next visit" and "Assessment and plan" are sentences; "Plan
 * monitor" and "Diagnosis irreversible pulpitis" are labels missing a colon. The
 * discriminator is whether the next word can begin a statement.
 */
const CONTINUES_A_PHRASE =
  /^(?:of|and|or|for|to|in|on|with|was|were|is|are|has|have|had|by|from|at|the|a|an|reviewed|recorded|updated|discussed|completed|noted)\b/i;

export function punctuateSectionLabels(input: string): string {
  const alternation = SECTION_LABELS.join("|");
  return input.replace(
    new RegExp(`(^|[.!?]\\s+|\\n)(${alternation})\\s+(?![:\\-])`, "g"),
    (m, lead: string, label: string, offset: number, whole: string) => {
      const after = whole.slice(offset + m.length);
      if (CONTINUES_A_PHRASE.test(after)) return m;
      return `${lead}${label}: `;
    }
  );
}
