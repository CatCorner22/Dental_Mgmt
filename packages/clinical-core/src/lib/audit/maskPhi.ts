import type { AuditFinding } from "./types";

// Replace a flagged identifier with a random opaque pseudonym.
//
// The screen already tells a clinician "this looks like an identifier." Until
// now the only ways forward were retype it by hand or waive the stop, and
// under time pressure between patients the waiver is the path of least
// resistance. That is a bad default for the one gate the whole PII-free
// premise rests on. This gives them a third option that takes one click and
// leaves the note MORE de-identified than before.
//
// WHAT A GOOD PSEUDONYM HAS TO BE, and why each property is load-bearing:
//
//  1. RANDOM, not derived. A mask computed FROM the identifier — a hash, a
//     cipher, initials, a birth year — is a pseudonym that still carries the
//     original inside it. Anyone holding the same function can recover or
//     confirm the value, and under HIPAA a re-identifiable code is still
//     protected data. `crypto.getRandomValues` has no relationship to the
//     input, so there is nothing to reverse and no key to leak.
//
//  2. CONSISTENT WITHIN ONE NOTE. If "John Smith" appears three times it must
//     become the same token all three times, or the note stops making sense —
//     a reader cannot tell whether two masked mentions are one person or two.
//     Consistency comes from a per-note map built at mask time, NOT from
//     deriving the token from the text.
//
//  3. NOT CONSISTENT ACROSS NOTES. Deliberate, and the reason this is not a
//     hash. A token stable across every note in the practice becomes a durable
//     patient key: link enough masked notes on [PERSON-A7K2] and the set
//     re-identifies someone even though no single note does. A fresh random
//     token per note keeps each note an island.
//
//  4. OBVIOUSLY A MASK. `[PERSON-A7K2]` cannot be mistaken for clinical text
//     or for a real chart number, and it survives the round trip into Curve
//     Hero as something a human immediately reads as redacted.
//
// This never runs by itself. It is offered to the clinician, applied to the
// fields they choose, and the audit re-runs afterwards on the real text.

export type MaskKind = "PERSON" | "CONTACT" | "ID" | "DATE" | "VALUE";

// Unambiguous alphabet: no O/0, I/1, L, S/5, so a token read aloud across an
// operatory or copied by hand cannot come back as a different token.
const ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789";
const TOKEN_LENGTH = 4;

function randomToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  // Rejection-free modulo is fine here: the alphabet is 29 and the bias across
  // 256 values is negligible for a label whose only job is to be distinct
  // within one note. This is not key material and must never be used as any.
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

// Which mask a finding earns, from its rule id. A masked phone should not read
// as a person and a masked date should not read as a record number — the
// replacement has to preserve what KIND of fact was there, or the note loses
// its meaning along with its identifier.
export function maskKindFor(ruleId: string): MaskKind {
  if (ruleId.startsWith("phi.name")) return "PERSON";
  if (ruleId === "phi.phone" || ruleId === "phi.email") return "CONTACT";
  if (ruleId.startsWith("phi.date")) return "DATE";
  if (ruleId === "phi.ssn" || ruleId === "phi.ssn-bare" || ruleId === "phi.mrn") return "ID";
  return "VALUE";
}

export interface MaskPlanEntry {
  /** Exact text to replace, as the screen matched it. */
  matchedText: string;
  /** What it is replaced with, e.g. "[PERSON-A7K2]". */
  token: string;
  kind: MaskKind;
  ruleId: string;
}

export const MASK_TOKEN_PATTERN = /\[(?:PERSON|CONTACT|ID|DATE|VALUE)-[A-Z2-9]{4}\]/g;

/**
 * Build the replacement plan for a set of findings.
 *
 * One token per distinct matched string, so repeats of the same identifier
 * collapse to the same mask and two different identifiers never collide.
 */
export function buildMaskPlan(findings: AuditFinding[]): MaskPlanEntry[] {
  const byText = new Map<string, MaskPlanEntry>();
  const usedTokens = new Set<string>();
  for (const f of findings) {
    const matchedText = f.matchedText;
    // Nothing to replace, or the text is already a mask from an earlier pass —
    // masking a mask would churn the note on every click.
    if (!matchedText || byText.has(matchedText)) continue;
    if (new RegExp(`^${MASK_TOKEN_PATTERN.source}$`).test(matchedText)) continue;
    const kind = maskKindFor(f.ruleId);
    let token = `[${kind}-${randomToken()}]`;
    // Collisions are ~1 in 700k per pair, but a collision would merge two
    // different people into one token inside a clinical record, so it is
    // cheaper to just retry than to reason about the odds.
    let guard = 0;
    while (usedTokens.has(token) && guard++ < 20) token = `[${kind}-${randomToken()}]`;
    usedTokens.add(token);
    byText.set(matchedText, { matchedText, token, kind, ruleId: f.ruleId });
  }
  // Longest first: if one match is a substring of another ("865-555-1234"
  // inside "Call 865-555-1234"), replacing the short one first would corrupt
  // the long one and leave part of the identifier behind.
  return [...byText.values()].sort((a, b) => b.matchedText.length - a.matchedText.length);
}

// A hyphen counts as part of a word here, matching the `(?<![-\w])` guard the
// name patterns in rules/phi.ts already use. Without it "Ray" replaces inside
// "X-Ray" and the radiograph becomes a person.
function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z0-9_-]/.test(c);
}

interface MaskSpan {
  start: number;
  end: number;
  token: string;
}

/**
 * Apply a plan to one string.
 *
 * INDEX-BASED AND SINGLE-PASS, and both properties are load-bearing.
 *
 * This was `split(matchedText).join(token)` per entry, applied in sequence to
 * the output of the previous entry. Two failures followed, and both ended with
 * an identifier still in the note while the re-audit reported AUDIT PASS:
 *
 *  1. OVERLAPPING matches annihilated each other. "John Smith, Mary Jones"
 *     yields `John Smith`, `Mary Jones`, and — spuriously, across the comma —
 *     `Smith, Mary`. Replacing the longest first destroyed the anchors of the
 *     other two, whose replacements then silently no-opped, leaving
 *     "John [PERSON-x] Jones": both real names half-masked. Which text
 *     survived was decided by an accidental string-length tie.
 *  2. A one-word match replaced INSIDE other words, so "Ray" rewrote "X-Ray",
 *     and the same person picked up two different tokens — breaking the
 *     documented property that repeats collapse to one token.
 *
 * Now every occurrence is located against the ORIGINAL text, overlaps are
 * resolved once (leftmost, then longest), and the result is assembled in a
 * single pass — so no replacement can eat another's anchor.
 *
 * Still never a regex built from user text: `indexOf` only.
 */
export function applyMaskPlan(text: string, plan: MaskPlanEntry[]): string {
  const spans: MaskSpan[] = [];
  for (const entry of plan) {
    const needle = entry.matchedText;
    if (!needle) continue;
    const guardStart = /^[A-Za-z0-9_]/.test(needle);
    const guardEnd = /[A-Za-z0-9_]$/.test(needle);
    let from = 0;
    for (;;) {
      const i = text.indexOf(needle, from);
      if (i === -1) break;
      const okStart = !guardStart || !isWordChar(text[i - 1]);
      const okEnd = !guardEnd || !isWordChar(text[i + needle.length]);
      if (okStart && okEnd) spans.push({ start: i, end: i + needle.length, token: entry.token });
      // +1, not +needle.length: overlapping candidates must all be DISCOVERED
      // so the resolution below can pick between them deliberately.
      from = i + 1;
    }
  }
  if (spans.length === 0) return text;

  // Leftmost wins; at the same start the longer span wins. A span that starts
  // inside one already kept is dropped rather than applied on top of it.
  spans.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  let out = "";
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    out += text.slice(cursor, span.start) + span.token;
    cursor = span.end;
  }
  return out + text.slice(cursor);
}
