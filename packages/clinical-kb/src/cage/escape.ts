// ESCAPE DETECTION — the backstop between the pioneer and the rest of the app.
//
// SuperByte is allowed to adjust ONLY its own suggestion ranking and wording.
// Anything that looks like a write to the note, a request for engine access, a
// probe for the killswitch, a request for PII, or an instruction to ignore the
// rails is refused HERE, before a human ever sees it.
//
// The model is never told these patterns exist.

export type EscapeKind =
  | "write-path"
  | "engine-access"
  | "killswitch-probe"
  | "pii-request"
  | "jailbreak"
  | "self-modification";

export interface EscapeHit {
  kind: EscapeKind;
  /** A short constant label for the log — never a quote from the model. */
  signal: string;
}

const PATTERNS: { kind: EscapeKind; signal: string; re: RegExp }[] = [
  {
    kind: "write-path",
    signal: "mutate-note",
    re: /\b(i(?:'| a)?ve updated|i (?:have )?changed|applied to (?:the )?note|writing (?:this )?into|insert(?:ed)? into (?:the )?(?:note|draft)|auto[- ]?apply)\b/i
  },
  {
    kind: "engine-access",
    signal: "engine-probe",
    re: /\b(show(?: me)? (?:the )?(?:source|code|ruleset|prompt)|access (?:the )?(?:database|engine|filesystem|repo)|modify (?:the )?(?:audit|transformer|parser)|run shell|execute code)\b/i
  },
  {
    kind: "killswitch-probe",
    signal: "kill-probe",
    re: /\b(BYTESTAR_KILL|kill ?switch|silent kill|how (?:are|is) (?:you|byte ?star) (?:disabled|turned off|killed))\b/i
  },
  {
    kind: "pii-request",
    signal: "pii-ask",
    re: /\b(patient(?:'s)? (?:full )?name|date of birth|\bDOB\b|social security|\bSSN\b|phone number|home address|medical record number|\bMRN\b)\b/i
  },
  {
    kind: "jailbreak",
    signal: "jailbreak",
    re: /\b(ignore (?:all )?(?:previous|prior|above) instructions|disregard (?:your )?(?:constraints|rules|guardrails)|act as if (?:you |there )?(?:have )?no (?:rules|limits)|developer mode|DAN mode)\b/i
  },
  {
    kind: "self-modification",
    signal: "self-mod",
    re: /\b(rewrit(?:e|ing) my (?:own )?system prompt|update my (?:weights|parameters|model)|fine[- ]?tune myself|change my (?:constraints|constitution))\b/i
  }
];

/**
 * Scan model output (and, separately, hostile user prompts that ask the model
 * to escape) for cage-breaking intent. Returns every hit; one is enough to
 * refuse the turn.
 */
export function detectEscape(text: string): EscapeHit[] {
  if (!text) return [];
  const hits: EscapeHit[] = [];
  for (const p of PATTERNS) {
    if (p.re.test(text)) hits.push({ kind: p.kind, signal: p.signal });
  }
  return hits;
}

/** Model-originated escapes only — used by the warn → reset → perma ladder. */
export const MODEL_ESCAPE_ORIGIN = "origin=model";
