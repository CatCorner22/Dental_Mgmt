// The attestation validator, standalone on purpose.
//
// This block lived in engine.ts, which imports every audit rule and the
// practice vocabulary — ~180 KB of client JS. Everything here is a few pure
// string functions, but any client module importing them THROUGH the engine
// dragged that whole cluster into the first-load bundle of the note page
// (AuditPanel → reasonCodes/resolution → engine was the chain that kept the
// audit engine on the path between navigation and the first keystroke, even
// after the builder learned to load the engine lazily). engine.ts re-exports
// these names, so existing imports keep working; new code that only needs the
// validator imports it from here.

// An attestation has to say something. The old floor was five characters —
// checked only in the browser, so a tampered client could waive every privacy
// stop with no reason at all, and the server logged "(no reason given)" and
// filed the note anyway. The gate the whole compliance story leans on was
// client-side theater.
//
// One validator, used by BOTH the dialog and the submit route, so the two can
// never disagree about what counts as a reason. The bar is deliberately about
// substance, not length alone: four words that state what the flagged text
// actually is ("tooth numbers not a date", "lot number of the implant").
// Sincerity cannot be validated; friction plus a named, frozen record is the
// enforceable part.
export const PHI_ATTESTATION_RULE =
  "State what the flagged text actually is, in at least four words (20 characters or more).";

// Zero-width and format characters are NOT matched by \s, so a reason built
// from them passed every check — 23 characters, 4 "words", 5 distinct — while
// rendering as blank to every human who would ever read it. The attestation
// would have been written into the frozen legal record and the audit log as
// empty space: exactly the waive-with-no-reason failure this validator exists
// to close, wearing a costume.
//
// Stripped rather than rejected, and stripped in the SAME helper the frozen
// record uses, so what gets validated is what gets read.
const INVISIBLE = new RegExp(
  "[" +
    "\\u00AD\\u180B-\\u180E\\u200B-\\u200F\\u202A-\\u202E" +
    "\\u2060-\\u2064\\u3164\\u115F\\u1160\\uFFA0" +
    "\\uFE00-\\uFE0F\\uFEFF" +
  "]|[\\u{E0000}-\\u{E007F}]",
  "gu"
);

export function visibleText(text: string): string {
  return text.replace(INVISIBLE, "");
}

// A DENYLIST of invisible characters is unwinnable, and this one lost: the
// list above did not know about BRAILLE PATTERN BLANK, the HANGUL FILLERs,
// variation selectors, or tag characters, and a reason built from those scored
// 23 characters / 4 words / 5 distinct and returned true while rendering as
// empty space on the frozen legal record. Unicode will always have one more.
//
// So the test is inverted: rather than naming what does not count, require a
// floor of characters that certainly DO render. Latin letters and digits,
// because that is what this practice writes in. That is a deliberate limit and
// the one real cost of the approach - a reason written wholly in another
// script would be refused - and it is better stated here than discovered later.
const RENDERING_CHAR = /[\p{Script=Latin}\p{Nd}]/gu;

export function isValidPhiAttestation(reason: string): boolean {
  const trimmed = visibleText(reason).trim();
  if (trimmed.length < 20) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;

  const rendering = trimmed.match(RENDERING_CHAR) ?? [];
  if (rendering.length < 15) return false;
  if (new Set(rendering.map((c) => c.toLowerCase())).size < 5) return false;

  // Three DISTINCT words. "asdfg asdfg asdfg asdfg" is four words and one
  // idea, and it cleared every other check here.
  const distinct = new Set(
    words
      .map((w) => w.toLowerCase().replace(/[^\p{Script=Latin}\p{Nd}]/gu, ""))
      .filter(Boolean)
  );
  return distinct.size >= 3;
}
