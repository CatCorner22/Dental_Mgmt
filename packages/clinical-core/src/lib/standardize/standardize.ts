import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { MISSPELLINGS, MEDICATION_WORDS } from "@/lib/vocab/misspellings";
import { VAGUE_PHRASES, STALE_PHRASES, STIGMATIZING_PHRASES } from "@/lib/vocab/vague-phrases";
import { SHORTHAND, SHORTHAND_OWNS } from "@/lib/vocab/shorthand";
import { findImplausibleQuantities } from "./plausibility";
import { foldDigits } from "@/lib/text/foldDigits";
import {
  expandDurationX,
  expandToothHash,
  punctuateSectionLabels,
  restoreInitialismCase,
  separateGluedAbbreviations
} from "./notation";
import type { ReadingProposal } from "./proposeReading";
import { resolveReadingProposal } from "./readingProposer";

// Paste-to-standard: the "writing on rails" pass, moved out of the companion
// skill and into the app.
//
// THE GOVERNING SPLIT, and the reason this module is worth reading before
// changing: a rewrite is either DETERMINISTIC or it is a JUDGEMENT CALL, and
// those two must never be mixed.
//
//   APPLIED — the replacement is fixed, language-only, and adds no clinical
//   claim. "x-ray" is always "radiograph". "abcess" is always "abscess".
//   Nothing about the patient changes; only the wording does.
//
//   FLAGGED — the correct replacement needs facts that the shorthand is
//   hiding. "PA" could be a periapical radiograph or a posteroanterior
//   cephalometric one. "tolerated well" needs the observed response. A
//   medication-name typo could be two different drugs. Guessing here would
//   invent clinical content, so the tool refuses and asks.
//
// Two rules fall out of that split and are enforced by tests:
//   1. A medication-name typo is NEVER auto-corrected, even though it sits in
//      the same misspelling table as everything else. "amoxicilin" is almost
//      certainly amoxicillin — but "almost certainly" is not a standard a drug
//      name is allowed to be corrected on.
//   2. Nothing here writes a clinical assertion, adds a finding, or removes a
//      negation. The output says exactly what the input said, in standard words.
//
// The result is a PROPOSAL. The person reads the itemised list and chooses to
// accept it. That is what keeps "no suggestion is ever auto-applied" true while
// still making this a one-click tool.

export interface AppliedChange {
  kind: "spelling" | "abbreviation" | "shorthand" | "formatting";
  from: string;
  to: string;
  count: number;
  why: string;
}

export interface RaisedFlag {
  kind:
    | "abbreviation"
    | "ambiguous-shorthand"
    | "vague-phrase"
    | "stale-text"
    | "stigmatizing"
    | "medication-spelling"
    | "implausible-quantity"
    | "truncated";
  display: string;
  guidance: string;
  count: number;
  /**
   * Optional reading hint for ambiguous shorthand. Never auto-applied —
   * the writer must still type the words. See proposeReading.ts.
   */
  proposal?: ReadingProposal;
}

export interface StandardizeResult {
  text: string;
  applied: AppliedChange[];
  flags: RaisedFlag[];
  /** True when the text is already standard: nothing applied, nothing flagged. */
  clean: boolean;
  /**
   * True when the input exceeded MAX_INPUT and the tail was dropped.
   *
   * This has to be reported, not swallowed. The API route rejects an oversize
   * paste with a 413, but the INLINE builder button calls this function
   * directly in the browser with no such check — so without this flag a
   * clinician with a very long field would silently get a SHORTER note back
   * and nothing on screen would say so. Losing the end of a clinical note
   * quietly is the worst thing this module could do.
   */
  truncated: boolean;
}

const MAX_INPUT = 20000;

// Collapse runs of whitespace but keep paragraph breaks, which carry meaning in
// a clinical note (one paragraph per phase of the visit).
function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    // \u2028 LINE SEPARATOR and \u2029 PARAGRAPH SEPARATOR are LINE
    // BREAKS, and belong here beside \r\n rather than in the deletion class
    // below. Deleting them ran two lines together with no separator at all: a
    // Word soft break between "No bleeding" and "Swelling resolved" produced
    // the single token "No bleedingSwelling resolved." Two independent
    // clinical statements welded into nonsense, in the copy that a clinician
    // pastes into Curve Hero.
    .replace(/[\u2028\u2029]/g, "\n")
    // Invisible characters that survive a copy-paste out of a PDF or an EDR
    // and then defeat every downstream match. Written as escapes, not
    // literals: a source file holding real zero-width bytes is unreviewable
    // in a diff, which is how these get missed in the first place.
    .replace(
      // \u2066-\u2069 are the LRI/RLI/FSI/PDI isolates, the modern
      // replacements for the \u202A-\u202E overrides beside them, and able
      // to reorder how digits and punctuation DISPLAY in a legal record.
      //
      // \u061C is the Arabic letter mark, same bidi family as \u200E/\u200F.
      // \uFE00-\uFE0F are variation selectors and \uFFF9-\uFFFB interlinear
      // annotation: both render as nothing at all. \u{E0000}-\u{E007F} are
      // the TAG characters, which encode arbitrary ASCII invisibly and are
      // the standard way hidden text is smuggled through a copy-paste.
      /[\u00AD\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFE00-\uFE0F\uFEFF\uFFF9-\uFFFB]|[\u{E0000}-\u{E007F}]/gu,
      ""
    )
    // Decimal digits from another script onto ASCII. "٥٠٠ mg" and "５００ mg" read
    // as five hundred to a person and are invisible to every \d-based rule in the
    // audit engine, which is how a phone number or an SSN could sit in a note
    // that screened clean. The obfuscation screen now flags them, and this is
    // what makes its advice ("press Standardize") true — without it the finding
    // named a remedy that did nothing.
    //
    // Safely in the APPLIED half: ٥٠٠ and 500 are the same quantity written two
    // ways, so the number the note asserts does not change. Folded before the
    // spacing and punctuation work below, so "５００mg" reaches the unit-spacing
    // rule as "500mg" and comes out as "500 mg".
    .replace(/\p{Nd}/gu, (d) => foldDigits(d))
    // C0 controls other than tab and newline. A NUL reaching a practice-
    // management system that handles C strings truncates the note at that
    // byte, silently discarding everything a clinician wrote after it.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // Everything that renders as a space but is not one to [ \t]. This was an
    // arbitrary subset before: \u2002 is indistinguishable from a space on
    // screen, so "4 mm" written with one looked correct while defeating every
    // \b-anchored rule downstream.
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    // Smart punctuation to ASCII: an em-dash or curly quote pasted from Word
    // renders inconsistently and breaks naive matching later.
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // A space before terminal punctuation, and a missing one after.
    //
    // The lookahead protects a NAKED LEADING DECIMAL. Without it this rule read
    // the point in "Midazolam .5 mg IV." as stray punctuation, deleted the
    // space, and produced "Midazolam.5 mg IV." — a dose welded onto the drug
    // name in a document that is a legal record. The Joint Commission already
    // prohibits writing a dose that way ("use 0.X mg"); silently gluing it to
    // the preceding word makes an error-prone construct worse rather than
    // raising it, which is what the rule below now does instead.
    .replace(/ +([,;:!?]|\.(?!\d))/g, "$1")
    // Colon excluded: "MOD:B" and ratios like "1:100,000" are notation,
    // not prose punctuation.
    .replace(/([,;])(?=[A-Za-z])/g, "$1 ")
    .trim();
}

// Sentence case. Typed notes arrive in lowercase far more often than not, and a
// note that opens mid-case reads as unfinished to whoever audits it later.
// Capitalising the first letter of a sentence changes no meaning and adds no
// claim, so it belongs in the applied half.
//
// Only the letter AFTER a sentence terminator or a line start is touched.
// Nothing mid-sentence is altered, so "mesial" never becomes "Mesial" and an
// intentionally lowercase term survives.
function sentenceCase(input: string): string {
  return input
    .split("\n")
    .map((line) => {
      if (/^[-*#|>]/.test(line.trim())) return line; // headings and list markers
      return line
        .replace(/^(\s*)([a-z])/, (_m, pre: string, ch: string) => pre + ch.toUpperCase())
        .replace(
          /([.!?])(\s+)([a-z])/g,
          (m: string, dot: string, gap: string, ch: string, offset: number, whole: string) => {
            // A dotted abbreviation's final period is not a sentence boundary.
            // "Ibuprofen 600 mg p.r.n. pain" is ONE instruction; capitalising
            // after it produced "p.r.n. Pain", which reads as a new sentence
            // and splits a prescription from the condition it treats.
            //
            // This bites hardest on the abbreviations the tool deliberately
            // refuses to expand — q.d. and q.o.d. are on the ISMP do-not-use
            // list and are left exactly as written, so they always reached the
            // caser intact.
            if (/(?:\b[A-Za-z]\.){2,}$/.test(whole.slice(0, offset + 1))) return m;
            return dot + gap + ch.toUpperCase();
          }
        );
    })
    .join("\n");
}

// A measurement and its unit are separate tokens: "500mg" is one word to a
// reader skimming for a dose. Bounded to the units the practice actually
// writes, so a tooth designation or a date is never split.
// No "%": a percent sign is a non-word character, so the trailing \b matched
// only when a LETTER followed — i.e. exactly the case ("40%oxygen") where
// inserting a space is wrong, and never the ordinary "30%".
const UNIT_GLUE = /\b(\d+(?:\.\d+)?)(mg|mcg|kg|mL|ml|mm|cm|g)\b/g;

function spaceUnits(input: string): string {
  return input.replace(UNIT_GLUE, "$1 $2");
}

// Sentence-final punctuation. A note that ends mid-thought reads as truncated,
// and a reader cannot tell whether content was lost.
function ensureTerminalPeriod(input: string): string {
  return input
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return t;
      // Leave list markers and headings alone; they are not sentences.
      if (/^[-*#|>]/.test(t)) return t;
      // A trailing comma or dash means the writer is mid-thought or mid-list;
      // appending a period there produced ",." and "-.".
      if (/[.!?:;,\-\u2013\u2014]$/.test(t)) return t;
      return `${t}.`;
    })
    .join("\n");
}

// Case- and number-preserving replacement.
//
// Three bugs lived here, all of the same species: the replacement was fitted to
// the SHAPE of the match without looking at its CONTEXT.
//
//  - "4 x-rays" became "4 radiograph". The pattern matches the plural; the
//    replacement was singular. The count of images is a billing and legal fact,
//    so losing the plural changes the record.
//  - "required I&D at the buccal space" became "required Incision and drainage
//    at". Title case was applied whenever the match happened to start with a
//    capital, with no idea whether it sat at the start of a sentence.
//  - "PT referral" became "PATIENT referral": all-caps propagated onto a
//    single-word replacement. (The PT pattern itself is fixed separately —
//    all-caps PT is physical therapy, not a patient.)
function isSentenceStart(text: string, offset: number): boolean {
  const before = text.slice(0, offset);
  // Start of input, start of a line, or after a sentence terminator.
  return /(?:^|[.!?]["')\]]?\s+|\n\s*)$/.test(before);
}

function applyPlural(sample: string, replacement: string): string {
  // Only when the replacement is a single word — pluralising the last word of a
  // phrase ("scaling and root planings") would be worse than leaving it.
  const plural = /s$/i.test(sample) && !/s$/i.test(replacement) && !replacement.includes(" ");
  return plural ? `${replacement}s` : replacement;
}

function matchCase(
  sample: string,
  replacement: string,
  opts: { sentenceStart: boolean }
): string {
  const withNumber = applyPlural(sample, replacement);
  const oneWord = !withNumber.includes(" ");
  // All-caps propagates only to a single-word replacement. An initialism like
  // "RCT" expanding to a phrase must not become "ROOT CANAL THERAPY" — capitals
  // there say "this was an abbreviation", not "this was shouted".
  if (oneWord && sample === sample.toUpperCase() && sample.length > 1 && /[A-Z]/.test(sample)) {
    return withNumber.toUpperCase();
  }
  // Capitalise ONLY at a real sentence boundary. Mid-sentence, the replacement
  // keeps its natural lowercase however the abbreviation was written.
  if (opts.sentenceStart) {
    return withNumber[0].toUpperCase() + withNumber.slice(1);
  }
  return withNumber;
}

// Escape a literal for use inside a RegExp. Written out rather than inlined
// because the inline version of this was subtly wrong and silently produced a
// pattern that could not match what it was built to find.
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bump<T extends { count: number }>(list: T[], key: (x: T) => string, item: T): void {
  const found = list.find((x) => key(x) === key(item));
  if (found) found.count += item.count;
  else list.push(item);
}

export function standardize(raw: string): StandardizeResult {
  const applied: AppliedChange[] = [];
  const flags: RaisedFlag[] = [];

  const source = typeof raw === "string" ? raw : "";
  const truncated = source.length > MAX_INPUT;
  const input = source.slice(0, MAX_INPUT);
  const whitespaced = normalizeWhitespace(input);
  if (whitespaced !== input.trim()) {
    applied.push({
      kind: "formatting",
      from: "inconsistent spacing and punctuation",
      to: "normalized",
      count: 1,
      why: "Collapsed stray spacing, straightened pasted quotes and dashes, and removed invisible characters."
    });
  }

  let text = whitespaced;

  // ---- Notation, BEFORE any vocabulary lookup. Ordering is the whole point.
  //
  // Un-gluing has to happen first or the tables cannot see what they are looking
  // for: "reappoint 6mo" has no word boundary between "6" and "m", so the months
  // rule never matched and the token survived every pass untouched. Measured on a
  // real note before this line existed.
  //
  // Tooth notation runs here too rather than during presentation, so a later
  // reader of this function sees notation settled before words change.
  const beforeNotation = text;
  text = expandToothHash(expandDurationX(separateGluedAbbreviations(text)));
  if (text !== beforeNotation) {
    applied.push({
      kind: "formatting",
      from: "chart notation",
      to: "written out",
      count: 1,
      why:
        "Wrote tooth designators, durations, and numbers run together with their units the way a " +
        "reader outside dentistry can follow. \"#14\" means nothing to an insurer or an attorney."
    });
  }

  // ---- Spelling. Whole words only, case-preserving.
  for (const [wrong, right] of Object.entries(MISSPELLINGS)) {
    const re = new RegExp(`\\b${wrong}\\b`, "gi");
    const hits = text.match(re);
    if (!hits) continue;
    // Rule 1: a drug name is never silently corrected.
    if (MEDICATION_WORDS.has(right.toLowerCase())) {
      bump(flags, (f) => f.display, {
        kind: "medication-spelling",
        display: hits[0],
        guidance: `This looks like a misspelling of "${right}", but medication names are never corrected automatically. Confirm the drug against the source record and fix it by hand.`,
        count: hits.length
      });
      continue;
    }
    text = text.replace(re, (m: string, ...rest: unknown[]) => {
      const offset = rest[rest.length - 2] as number;
      return matchCase(m, right, { sentenceStart: isSentenceStart(text, offset) });
    });
    bump(applied, (a) => `${a.kind}:${a.from}`, {
      kind: "spelling",
      from: hits[0],
      to: right,
      count: hits.length,
      why: "Standard spelling from the practice lexicon."
    });
  }

  // ---- Shorthand: expand on FIRST USE, define parenthetically, then leave it.
  //
  // "Root canal therapy (RCT) was started. The RCT was completed later."
  //
  // Expanding every occurrence would be worse than leaving them: a note that
  // says "root canal therapy" six times reads like a form letter, and clinicians
  // stop using the tool. Expanding once and defining the term keeps the note
  // readable to an outsider AND natural to write.
  for (const sh of SHORTHAND) {
    const re = new RegExp(sh.pattern.source, sh.pattern.flags);
    const hits = text.match(re);
    if (!hits) continue;

    if (sh.alternatives) {
      // More than one real reading. Asserting one would put a clinical claim in
      // the note that the writer never made. A proposal may hint; it never writes.
      const proposal = resolveReadingProposal(sh.display, sh.alternatives, text);
      bump(flags, (f) => f.display, {
        kind: "ambiguous-shorthand",
        display: sh.display,
        guidance: `"${sh.display}" has more than one meaning here: ${sh.alternatives.join("; ")}. Write the one you mean.`,
        count: hits.length,
        ...(proposal ? { proposal } : {})
      });
      continue;
    }

    // Already defined somewhere in this text? Then the convention is satisfied
    // and re-expanding would produce "root canal therapy (RCT) (RCT)". The
    // plural definition counts too — "bitewing radiographs (BWs)" is this
    // tool's own first-use output, and failing to recognise it broke
    // idempotency exactly the way the BWX bug below did.
    const definedAlternatives = [
      `${escapeRegExp(sh.expansion)}[\\s.,;:]*\\(${escapeRegExp(sh.display)}\\)`
    ];
    if (sh.pluralExpansion) {
      definedAlternatives.push(
        `${escapeRegExp(sh.pluralExpansion)}[\\s.,;:]*\\(${escapeRegExp(sh.display)}s\\)`
      );
    }
    const defined = new RegExp(definedAlternatives.join("|"), "i");
    if (defined.test(text)) continue;

    // EVERY occurrence is normalised to the canonical `display`, and only the
    // first is expanded. The variants in these patterns are the reason:
    // /\bBWX?\b/ matches "BWX", /\bFM[XS]\b/ matches "FMS", and
    // /\bb\.?i\.?d\.?\b/ matches "b.i.d." — all with a canonical display of
    // "BW", "FMX", "bid".
    //
    // Writing the MATCHED text into the parentheses was a real bug: it produced
    // "bitewing radiograph (BWX)", which the `defined` check above (looking for
    // "(BW)") then failed to recognise, so a second pass expanded it again into
    // "bitewing radiograph (bitewing radiograph (BWX))". Normalising fixes the
    // idempotency AND is the more correct behaviour anyway — standardising is
    // the entire job, so "BWX" and "b.i.d." should come out as the one spelling
    // the practice agreed on.
    // Three things the matched text carries that the canonical form does not,
    // each of which was being thrown away by replacing with a bare constant:
    //
    //  PLURAL. "TMJs palpated bilaterally" became "temporomandibular joint
    //  (TMJ) palpated bilaterally" — two joints silently became one. "SSCs
    //  placed on teeth A and B" documented one crown for two teeth. Counts are
    //  billing and legal facts, which is exactly why applyPlural exists for the
    //  abbreviation path; this path simply was not using it.
    //
    //  TRAILING PERIOD. The dosing patterns end in a mandatory `\.`, so the
    //  match for "b.i.d." in "Rinse chlorhexidine b.i.d. Patient advised no
    //  alcohol." swallowed the sentence terminator and welded the next sentence
    //  onto the prescription — "twice daily (bid) Patient advised no alcohol."
    //  Two statements, one of them a negation, became one. Re-emitting the
    //  period keeps the sentence boundary the writer put there.
    //
    //  THE ACTUAL TOKEN. See the `from` on the change entry below.
    let first = true;
    let matchedFirst = "";
    let expandedTo = "";
    // A token the plural rule below normalised but could not expand, kept so
    // the change can still be REPORTED. See the `if (first)` branch after the
    // replace for why an unreported edit is the thing to avoid here.
    let normalizedOnly = "";
    text = text.replace(re, (m: string, ...rest: unknown[]) => {
      const offset = rest[rest.length - 2] as number;
      const src = rest[rest.length - 1] as string;
      // Does this abbreviation's own period ALSO end the sentence?
      //
      // "p.r.n. pain" — lowercase follows, so the period belongs to the
      // abbreviation alone and the prescription continues. Emitting one here
      // would split a single instruction in two.
      //
      // "b.i.d. Patient advised no alcohol." — a capital follows, so it is
      // doing double duty and the sentence genuinely ends. Swallowing it
      // welded a separate statement (often a negation) onto the prescription:
      // "twice daily (bid) Patient advised no alcohol."
      //
      // The previous rule always swallowed it, having over-corrected from an
      // earlier one that always split.
      const after = src.slice(offset + m.length);
      const endsSentence = m.endsWith(".") && (/^\s*$/.test(after) || /^\s+[A-Z]/.test(after));
      const tail = endsSentence ? "." : "";
      if (!first) return `${applyPlural(m, sh.display)}${tail}`;
      // PLURAL FIRST USE. "SSCs placed on teeth A and B" must not become the
      // singular "stainless steel crown (SSC) placed on teeth A and B" — that
      // documents one crown for two teeth, and a count is a billing and legal
      // fact. applyPlural cannot fix a multi-word expansion (it only appends
      // an "s", and only to a single word), so the correct plural comes from
      // the table's pluralExpansion — written by a human, per term. When the
      // table has none, the token is normalised but NOT expanded, and `first`
      // stays true so a later singular occurrence can carry the definition.
      const isPlural = /s$/i.test(m) && !/s$/i.test(sh.display);
      if (isPlural && !sh.pluralExpansion) {
        const normalized = applyPlural(m, sh.display);
        if (normalized !== m && !normalizedOnly) normalizedOnly = m;
        return `${normalized}${tail}`;
      }
      first = false;
      matchedFirst = m;
      expandedTo = isPlural
        ? `${sh.pluralExpansion} (${applyPlural(m, sh.display)})`
        : `${sh.expansion} (${sh.display})`;
      return `${expandedTo}${tail}`;
    });
    // Every occurrence was a plural this table cannot safely expand, so nothing
    // was DEFINED and there is no definition to report.
    //
    // But the token may still have been rewritten — "cbcts" comes out "CBCTs" —
    // and skipping straight past the reporting left that edit invisible: the
    // text changed, `applied` stayed empty, and the panel said "tidied". The
    // whole safety story on this screen is that a human reads the list of
    // changes and accepts it, which requires the list to contain the changes.
    // So a normalisation is reported as a normalisation, and says plainly why
    // it stopped short of expanding.
    if (first) {
      if (normalizedOnly) {
        bump(applied, (a) => `${a.kind}:${a.from}`, {
          kind: "shorthand",
          from: normalizedOnly,
          to: applyPlural(normalizedOnly, sh.display),
          count: 1,
          why: `Spelling normalised only. "${sh.display}" has no plural form in the table, and inventing one could change a count.`
        });
      }
      continue;
    }
    // `from` is what the note ACTUALLY said, not the table's canonical spelling.
    // Reporting the canonical form made every variant substitution invisible in
    // review: a note reading "NKA" produced the entry "NKDA → no known drug
    // allergies (NKDA)", so the one word that changed meaning never appeared in
    // the UI at all. The whole safety story here is that a human reads this list
    // and accepts it, which requires the list to say what was replaced.
    const shown = matchedFirst && matchedFirst !== sh.display ? matchedFirst : sh.display;
    bump(applied, (a) => `${a.kind}:${a.from}`, {
      kind: "shorthand",
      from: shown,
      to: expandedTo,
      count: 1,
      why:
        hits.length > 1
          ? `Defined on first use; the remaining ${hits.length - 1} stay as "${sh.display}".`
          : "Defined on first use."
    });
  }

  // ---- Abbreviations. Only the deterministic ones are applied.
  for (const abbr of BANNED_ABBREVIATIONS) {
    // Owned by the shorthand table above, which defines it on first use rather
    // than replacing every occurrence. Running both would double-process the
    // same initialism.
    if (SHORTHAND_OWNS.has(abbr.id)) continue;
    const re = new RegExp(abbr.pattern.source, abbr.pattern.flags);
    const hits = text.match(re);
    if (!hits) continue;
    if (abbr.severityClass === "style") {
      text = text.replace(re, (m: string, ...rest: unknown[]) => {
        const offset = rest[rest.length - 2] as number;
        return matchCase(m, abbr.replacement, { sentenceStart: isSentenceStart(text, offset) });
      });
      bump(applied, (a) => `${a.kind}:${a.from}`, {
        kind: "abbreviation",
        from: abbr.display,
        to: abbr.replacement,
        count: hits.length,
        why: "Ambiguous shorthand with one standard expansion."
      });
    } else {
      // The expansion depends on facts the shorthand hides. Asking is correct.
      bump(flags, (f) => f.display, {
        kind: "abbreviation",
        display: abbr.display,
        guidance: `Write the exact term: ${abbr.replacement}. Only the clinician knows which one this was.`,
        count: hits.length
      });
    }
  }

  // ---- Vague, stale, and stigmatizing phrases. Never rewritten — the
  // replacement IS the clinical content, and inventing it is the one thing this
  // tool must not do. That applies doubly to the stigmatizing list: swapping a
  // kinder word for a clinically meaningful one would change what the note
  // says about the visit, which is not a formatting decision.
  for (const [list, kind] of [
    [VAGUE_PHRASES, "vague-phrase"],
    [STALE_PHRASES, "stale-text"],
    [STIGMATIZING_PHRASES, "stigmatizing"]
  ] as const) {
    for (const phrase of list) {
      const re = new RegExp(phrase.pattern.source, phrase.pattern.flags);
      const hits = text.match(re);
      if (!hits) continue;
      bump(flags, (f) => f.display, {
        kind,
        display: phrase.display,
        guidance: phrase.replacement,
        count: hits.length
      });
    }
  }

  // Presentation last, so the replacements above matched against the text as
  // typed rather than against a half-reformatted version of it.
  const beforePresentation = text;
  // restoreInitialismCase runs AFTER sentenceCase, because sentenceCase is what
  // breaks the casing it repairs: a sentence-initial "nka." became "Nka.", an
  // initialism in title case, which reads as a typo in the one tool whose whole
  // claim is standard form.
  text = ensureTerminalPeriod(
    punctuateSectionLabels(restoreInitialismCase(spaceUnits(sentenceCase(text))))
  );
  if (text !== beforePresentation && !applied.some((a) => a.kind === "formatting")) {
    applied.push({
      kind: "formatting",
      from: "sentence case, spacing, and terminal punctuation",
      to: "normalized",
      count: 1,
      why: "Capitalized sentences, separated units from their numbers, and closed the final sentence."
    });
  }

  // Implausible quantities. Flagged, never corrected: the tool can tell that a
  // number cannot be right, and must not pretend to know what it should be.
  // Run on the FINAL text so the unit spacing above ("500mg" -> "500 mg") has
  // already happened and the numbers are in their standard form.
  for (const q of findImplausibleQuantities(text)) {
    flags.push({
      kind: "implausible-quantity",
      display: q.matched,
      guidance: q.reason,
      count: q.count
    });
  }

  if (truncated) {
    // Surfaced as a flag rather than an applied change: nothing was
    // standardised here, something was LOST, and the writer has to act.
    flags.unshift({
      kind: "truncated",
      display: "This note was too long and the end was cut off",
      guidance: `Only the first ${MAX_INPUT.toLocaleString()} characters were standardized. Standardize the rest separately, and check that nothing is missing from the end.`,
      count: 1
    });
  }

  return {
    text,
    applied,
    flags,
    clean: applied.length === 0 && flags.length === 0,
    truncated
  };
}
