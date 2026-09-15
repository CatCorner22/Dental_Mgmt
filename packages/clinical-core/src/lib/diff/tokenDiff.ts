// A word-level diff, so a clinician can see what the tool did to their words.
//
// Both transformation paths in this app REPLACE the text a person wrote: the
// deterministic standardizer rewrites shorthand in place, and the AI assist
// returns a restructured note. Until now each reported a summary — "3 changes
// applied", or a list of from/to pairs — and neither ever put the original
// beside the result. A summary is a claim about a change; a diff is the change.
// The difference matters most for the reader who is about to accept a rewrite
// of a legal record without reading it.
//
// No dependency. A word-level longest-common-subsequence is a few dozen lines,
// and every diff library worth adding brings a rendering opinion this app does
// not want. Deterministic and pure, like the rest of the pipeline.

export type DiffOp = "same" | "added" | "removed";

export interface DiffSpan {
  op: DiffOp;
  /** The text, including the whitespace that followed it in the source. */
  text: string;
}

/**
 * Split into diffable units: a word, or a run of whitespace/punctuation.
 *
 * Diffing by CHARACTER produces unreadable noise on prose ("radiograph" vs
 * "x-ray" becomes a scatter of single letters). Diffing by LINE is too coarse —
 * these are single-field edits where the whole change usually lives inside one
 * sentence. Words are the unit a person actually compares.
 */
export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

/**
 * Longest common subsequence over tokens, as a table of lengths.
 *
 * O(n·m) in time and memory, which is correct for this use: fields are capped
 * at 20,000 characters upstream, and the caller below bails out before building
 * a table large enough to matter.
 */
function lcsTable(a: string[], b: string[]): Uint32Array[] {
  const table: Uint32Array[] = Array.from(
    { length: a.length + 1 },
    () => new Uint32Array(b.length + 1)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

// Above this many tokens on either side, the quadratic table stops being free.
// A 4,000-token field is already far longer than any note field in this app, and
// returning a whole-text replacement is honest rather than wrong: it says "this
// changed" without pretending to a precision the budget did not buy.
const MAX_TOKENS = 4000;

/**
 * Compare two strings and return the spans that make up the change.
 *
 * Adjacent spans of the same kind are merged, so a rewritten phrase reads as one
 * removal and one addition rather than a stutter of word-sized edits.
 */
export function diffTokens(before: string, after: string): DiffSpan[] {
  if (before === after) return before ? [{ op: "same", text: before }] : [];
  if (!before) return [{ op: "added", text: after }];
  if (!after) return [{ op: "removed", text: before }];

  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return [
      { op: "removed", text: before },
      { op: "added", text: after }
    ];
  }

  const table = lcsTable(a, b);
  const spans: DiffSpan[] = [];
  const push = (op: DiffOp, text: string) => {
    const last = spans[spans.length - 1];
    if (last && last.op === op) last.text += text;
    else spans.push({ op, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("removed", a[i]);
      i++;
    } else {
      push("added", b[j]);
      j++;
    }
  }
  while (i < a.length) push("removed", a[i++]);
  while (j < b.length) push("added", b[j++]);

  return absorbInnerWhitespace(spans);
}

/**
 * Fold a matched space that sits between two edits of the same kind into them.
 *
 * Rewriting "b" as "x y z" leaves the spaces matching, so the raw walk emits
 * `+x`, `same( )`, `+y z` — one phrase reported as two changes with a sliver of
 * unchanged text between. The clinician reads a stutter instead of a
 * substitution. Only whitespace is absorbed, and only when both neighbours are
 * the same operation, so no word is ever moved from one side to the other.
 */
function absorbInnerWhitespace(spans: DiffSpan[]): DiffSpan[] {
  const out: DiffSpan[] = [];
  for (let k = 0; k < spans.length; k++) {
    const span = spans[k];
    const prev = out[out.length - 1];
    const next = spans[k + 1];
    if (
      span.op === "same" &&
      !/[^\s]/.test(span.text) &&
      prev &&
      next &&
      prev.op !== "same" &&
      prev.op === next.op
    ) {
      prev.text += span.text;
      continue;
    }
    if (prev && prev.op === span.op) prev.text += span.text;
    else out.push({ ...span });
  }
  return out;
}

/**
 * Is the whole change nothing but whitespace and punctuation?
 *
 * The standardizer's formatting pass adds a terminal period and tidies spacing
 * on almost every run. Marking that up beside a real substitution buries the
 * substitution, so the UI collapses a formatting-only diff into a single line
 * instead of rendering it.
 *
 * Compared on the LETTERS AND DIGITS of each side rather than on the diff
 * spans, because a period attaches to the word before it: "bleeding" and
 * "bleeding." are two different tokens, so a span-wise test sees a word
 * substitution and calls a full stop a real edit. Projecting both sides down to
 * their alphanumerics answers the question actually being asked — did any word
 * change, or only the punctuation around them?
 */
export function isFormattingOnly(before: string, after: string): boolean {
  const letters = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).join(" ").toLowerCase();
  return letters(before) === letters(after);
}

/** Counts for the summary line: how many words came out, how many went in. */
export function countWords(spans: DiffSpan[], op: DiffOp): number {
  return spans
    .filter((s) => s.op === op)
    .flatMap((s) => s.text.match(/[^\s]+/g) ?? []).length;
}
