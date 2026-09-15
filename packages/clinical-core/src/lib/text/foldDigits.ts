/**
 * Map every Unicode decimal digit onto its ASCII counterpart.
 *
 * Shared by the standardizer (which repairs the text) and the meaning verifier
 * (which compares it), so the two can never disagree about what a number is.
 *
 * `\p{Nd}` is the whole Number/decimal-digit category, which covers Arabic-Indic,
 * Devanagari, Thai, Bengali, fullwidth and the rest without this file naming a
 * single script. The value of a decimal digit is its offset from the zero of its
 * own block, and code-point arithmetic recovers that without a lookup table.
 *
 * The number is preserved exactly — ٥٠٠ and 500 are the same quantity written two
 * ways — which is what makes this a deterministic, language-only repair rather
 * than a clinical judgement.
 */
export function foldDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (d) => {
    const code = d.codePointAt(0)!;
    // Walk down to this digit's own block zero: the lowest contiguous code point
    // that is still a decimal digit, at most nine steps away.
    //
    // An earlier version returned "0" the moment it saw the character "0" while
    // walking, which quietly rewrote every ASCII number in a note — "19" became
    // "00" and "3" became "0". Input and output were corrupted identically, so
    // every comparison downstream still agreed and only the numbers printed back
    // to a clinician were fiction.
    let zero = code;
    while (zero > 0 && code - (zero - 1) < 10 && /\p{Nd}/u.test(String.fromCodePoint(zero - 1))) {
      zero--;
    }
    return String(code - zero);
  });
}

/**
 * Does this text contain a decimal digit that is not ASCII?
 *
 * A predicate rather than a regex on PHI_PATTERNS, because the obvious pattern
 * for "a digit run containing at least one non-ASCII digit" is
 * `\p{Nd}*(?![0-9])\p{Nd}\p{Nd}*` — and that is quadratic. On a run of n ASCII
 * digits the leading `\p{Nd}*` consumes to the end and backtracks through every
 * remaining position hunting a non-ASCII digit that never arrives, once per start
 * position. Measured: 1.8 ms at 1,000 digits, 28 ms at 4,000, 445 ms at 16,000,
 * 6.5 SECONDS at 64,000 — on a rule that runs inside the per-keystroke audit.
 *
 * Anchoring the match AT the non-ASCII digit instead makes it linear: an ASCII
 * digit fails the lookahead in constant time and the scan moves on.
 */
export const NON_ASCII_DIGIT = /(?![0-9])\p{Nd}[\p{Nd}]*/gu;
