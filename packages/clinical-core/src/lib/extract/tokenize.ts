// TOKENIZER — a note becomes a flat list of spans with types.
//
// Deliberately simple. It knows about letters, digits and punctuation, and it
// knows nothing about teeth, drugs or procedures. Every clinical judgement
// lives in the parser and the controlled tables, so that this file can never
// be the thing that decides "14" is a tooth.
//
// SPANS ARE EXACT AND THEY INDEX THE ORIGINAL STRING. Everything downstream —
// the ledger, the highlight that shows a user which words produced a fact, the
// coverage meter — depends on being able to point back at the exact characters
// the writer typed. So this does not normalize, lowercase, or fold anything
// in place. `lower` and `digits` are carried ALONGSIDE the original text
// rather than replacing it.
//
// The digit folding in particular has to be per-token for that reason:
// `foldDigits` on a whole string can change its LENGTH (an astral-plane digit
// is two UTF-16 units and its ASCII counterpart is one), which would silently
// shift every span after it. Folding one token at a time and keeping the
// original span is exact.

import { foldDigits } from "@/lib/text/foldDigits";

export type TokenKind = "word" | "number" | "hash" | "punct";

export interface Token {
  kind: TokenKind;
  /** Exactly as written. */
  text: string;
  /** Case-folded, for table lookups. */
  lower: string;
  /**
   * For `number` tokens: the value with every Unicode decimal digit mapped to
   * ASCII. A note pasted from a system with Arabic-Indic numerals still yields
   * a tooth number rather than a shrug.
   */
  digits?: string;
  /**
   * At least one line break sits between this token and the previous one.
   * The clause splitter treats that as a boundary: staff shorthand puts one
   * statement per line, and a "no" on one line must never negate a finding
   * three lines down. Found the hard way — a 1,500-line note parsed as ONE
   * clause, which made assertion scoping quadratic (12 seconds on a paste
   * that should cost 20 ms) and let negation scope leak across lines.
   */
  newline?: true;
  start: number;
  end: number;
}

// A word may contain internal apostrophes and hyphens ("patient's",
// "post-operative") but may not start or end with them.
const WORD_CHAR = /[\p{L}]/u;
const DIGIT_CHAR = /\p{Nd}/u;
const WORD_INNER = /[\p{L}\p{Nd}'’-]/u;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let sawNewline = false;

  const mark = <T extends Token>(t: T): T => {
    if (sawNewline && tokens.length > 0) t.newline = true;
    sawNewline = false;
    return t;
  };

  while (i < text.length) {
    const ch = text[i];

    if (/\s/.test(ch)) {
      if (ch === "\n" || ch === "\r") sawNewline = true;
      i++;
      continue;
    }

    if (ch === "#") {
      tokens.push(mark({ kind: "hash", text: "#", lower: "#", start: i, end: i + 1 }));
      i++;
      continue;
    }

    // A number is a digit run, optionally with ONE decimal point inside it.
    // "1:100,000" (an epinephrine ratio) is deliberately left as separate
    // tokens — the parser recognises the shape, because treating it as one
    // number here would mean this file knew what a vasoconstrictor ratio was.
    if (DIGIT_CHAR.test(ch)) {
      const start = i;
      while (i < text.length && DIGIT_CHAR.test(text[i])) i++;
      if (text[i] === "." && i + 1 < text.length && DIGIT_CHAR.test(text[i + 1])) {
        i++;
        while (i < text.length && DIGIT_CHAR.test(text[i])) i++;
      }
      const raw = text.slice(start, i);
      tokens.push(
        mark({
          kind: "number",
          text: raw,
          lower: raw.toLowerCase(),
          digits: foldDigits(raw),
          start,
          end: i
        })
      );
      continue;
    }

    if (WORD_CHAR.test(ch)) {
      const start = i;
      i++;
      while (i < text.length && WORD_INNER.test(text[i])) i++;
      // Trailing apostrophes and hyphens belong to the punctuation that
      // follows, not to the word: "patient-" is the word "patient".
      while (i > start + 1 && /['’-]/.test(text[i - 1])) i--;
      const raw = text.slice(start, i);
      tokens.push(mark({ kind: "word", text: raw, lower: raw.toLowerCase(), start, end: i }));
      continue;
    }

    tokens.push(mark({ kind: "punct", text: ch, lower: ch, start: i, end: i + 1 }));
    i++;
  }

  return tokens;
}

/**
 * Split a token list into clauses.
 *
 * CLAUSES, NOT SENTENCES, and the difference is the whole point. A dental note
 * is written as one long run of comma-separated fragments —
 *
 *     "#14 MOD comp, 2 carp lido, rubber dam, pt tol well"
 *
 * — and every fragment is a separate assertion about a different thing. Parsing
 * at sentence granularity would bind the anesthetic to the tooth and the tooth
 * to the patient's tolerance. Splitting on the separators the writer actually
 * used keeps each assertion in its own box, which is also what stops one
 * unparseable fragment from costing us the four around it.
 *
 * THE COMMA IS THE IMPORTANT ONE, and it is why this is not just a sentence
 * splitter. Negation scope runs to the end of the clause, so without a comma
 * break "no caries #14, composite #30 MOD placed" puts the composite inside the
 * scope of "no" and the extractor reports a restoration the note never denied
 * as denied. Under-asserting is the safer direction to fail in, but it is still
 * wrong, and on a busy note it would be wrong constantly.
 *
 * A comma inside a TOOTH LIST must not split ("#3, 14, 30" is one site group),
 * so a comma sitting between two things that could each be a tooth designator
 * is left alone. That test is local, deterministic and deliberately narrow: it
 * looks only at the token either side. The known cost is that a genuine list of
 * two bare numbers — "2, 3 units of anesthetic" — keeps its clauses joined.
 * Nothing is mis-parsed as a result, because a bare number is never a tooth
 * (see rule 1 in extract.ts); the clauses merely share a negation scope, which
 * is the conservative direction.
 */
const TOOTH_ISH = (t: Token | undefined): boolean => {
  if (!t) return false;
  if (t.kind === "hash") return true;
  if (t.kind === "number") {
    const n = Number(t.digits ?? t.text);
    return Number.isInteger(n) && n >= 1 && n <= 32;
  }
  return t.kind === "word" && /^[A-T]$/.test(t.text);
};

/**
 * A comma introducing WHERE the preceding clause happened.
 *
 * "Scaling and root planing, upper right and lower left quadrants" is one
 * assertion written in two halves, and splitting it stranded the location in a
 * clause with no procedure to attach to — so a note that plainly said which
 * quadrants were treated charted nothing at all.
 *
 * Narrow on purpose: only a quadrant reference immediately after the comma
 * counts. Anything else is a genuine new assertion and must still split, for
 * the negation-scope reason in the header.
 */
const QUADRANT_START = new Set(["upper", "lower", "maxillary", "mandibular"]);
const LOCATION_ISH = (t: Token | undefined): boolean => {
  if (!t || t.kind !== "word") return false;
  if (/^(?:UR|UL|LL|LR)$/.test(t.text)) return true;
  return QUADRANT_START.has(t.lower);
};

/**
 * Defensive ceiling on tokens per clause. No real clinical clause approaches
 * it — the longest clause across the whole shorthand corpus is under 40
 * tokens — but a pasted wall of text with no punctuation and no line breaks
 * would otherwise become one clause, and assertion scoping inside a clause is
 * O(facts × cues): quadratic on exactly the input an adversary would choose.
 * Splitting an oversized clause loses nothing clinical (the content was
 * never a clause) and keeps the per-keystroke path linear no matter what is
 * pasted into it.
 */
const MAX_CLAUSE_TOKENS = 250;

export function clauseRanges(tokens: Token[]): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  let from = 0;
  const push = (to: number) => {
    // The oversized-clause guard, applied at the single point every clause
    // passes through.
    let start = from;
    while (to - start > MAX_CLAUSE_TOKENS) {
      ranges.push({ from: start, to: start + MAX_CLAUSE_TOKENS });
      start += MAX_CLAUSE_TOKENS;
    }
    if (to > start) ranges.push({ from: start, to });
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // A line break is a clause boundary before anything else is considered:
    // staff shorthand is one statement per line, and negation must not leak
    // across lines. The boundary sits BEFORE this token, so the previous
    // clause ends at i and the new one starts here (no separator to skip).
    if (t.newline && i > from) {
      push(i);
      from = i;
    }
    if (t.kind !== "punct") continue;
    let isBreak = t.text === ";" || t.text === "." || t.text === "!" || t.text === "?";
    if (t.text === ",") {
      const insideToothList = TOOTH_ISH(tokens[i - 1]) && TOOTH_ISH(tokens[i + 1]);
      isBreak = !insideToothList && !LOCATION_ISH(tokens[i + 1]);
    }
    if (isBreak) {
      if (i > from) push(i);
      from = i + 1;
    }
  }
  if (from < tokens.length) push(tokens.length);
  return ranges;
}
