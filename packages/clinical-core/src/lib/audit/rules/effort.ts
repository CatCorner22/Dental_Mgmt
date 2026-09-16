import type { AuditFinding } from "../types";

// Effort enforcement. A clinical note is testimony, and testimony has a
// floor. These rules catch the note that was typed to satisfy the FIELD
// rather than the RECORD — keyboard mash, filler, and unprofessional
// characterization of the patient.
//
// The tone rule for every message here: cold logic, zero condescension. The
// note is blocked because a reader cannot use it, not because the author is
// bad. Say what a reader needs, and stop.

// Keyboard mash: one character repeated, or a run straight along a keyboard
// row. "asdf", "qwer", "zxcv" typed to fill a box appear in real audit
// findings across every documentation system ever deployed.
const MASH_PATTERNS: RegExp[] = [
  // WORD characters only. This was `(.)\1{5,}`, which matches ANY character —
  // so six spaces surviving a paste, or a "------" section divider, blocked a
  // correct note at S1. The precision corpus caught both. Repeated letters and
  // digits are still filler; repeated punctuation is formatting, and a stop the
  // writer cannot see is a stop they cannot act on.
  //
  // "______" keeps matching, and should: an underscore run in a clinical note is
  // an unfilled template blank, which residue.underscores also reports.
  /(\w)\1{5,}/, // aaaaaa
  /\b(?:asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm)[a-z]*\b/i,
  /\b(?:test(?:ing)?\s*){2,}\b/i,
  /\b(?:blah\s*){2,}\b/i,
  /\b(?:xxx+|zzz+|nnn+)\b/i
];

export function runGibberishRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const pattern of MASH_PATTERNS) {
    const m = pattern.exec(text);
    if (!m) continue;
    findings.push({
      ruleId: "effort.gibberish",
      category: "template-residue",
      severity: "S1",
      message:
        `"${m[0].slice(0, 30)}" is filler, not documentation. A reader three years from now ` +
        `gets exactly what is typed here and nothing else.`,
      matchedText: m[0].slice(0, 30),
      suggestion: "Replace the filler with what actually happened, or delete the line.",
      occurrences: 1
    });
    break; // one finding is the message; ten is nagging
  }
  return findings;
}

// Unprofessional characterization: wording that describes the PERSON instead
// of the VISIT. Complements the stigmatizing list (which covers clinical
// framing like "drug-seeking") with the plainly rude register that shows up
// when a note is written in frustration. Every one of these has been read
// aloud in a courtroom.
const RUDE: { pattern: RegExp; display: string; clinical?: RegExp }[] = [
  { pattern: /\b(?:crazy|insane|nuts|psycho|lunatic)\b/gi, display: "characterizing the patient's mental state" },
  { pattern: /\b(?:stupid|idiot(?:ic)?|moron(?:ic)?|dumb)\b/gi, display: "an insult" },
  { pattern: /\b(?:annoying|whiny|whining|dramatic|hysterical)\b/gi, display: "characterizing the patient's manner" },
  {
    pattern: /\b(?:liar|lying|lies)\b/gi,
    display: "an accusation of dishonesty",
    // "Patient positioned lying supine." "The lesion lies distal to #14."
    clinical: /\b(?:lying|lies)\s+(?:supine|prone|lateral|distal|mesial|buccal|lingual|facial|palatal|anterior|posterior|superior|inferior|adjacent|deep|within|along|beneath|below|above)\b/i
  },
  {
    pattern: /\b(?:lazy|filthy|disgusting|gross)\b/gi,
    display: "a judgment of the patient",
    // "Gross debridement" is the literal ADA D4355 description; gross caries and
    // gross calculus are ordinary clinical description of extent.
    clinical: /\bgross(?:ly)?\s+(?:debridement|caries|calculus|plaque|decay|deposits?|contamination|examination|pathology|anatomy|defect|mobility)\b/i
  },
  {
    pattern: /\bfat\b/gi,
    display: "a slur where a clinical term exists",
    // The buccal fat pad is an anatomical structure.
    clinical: /\b(?:buccal|masticatory|orbital|periorbital)\s+fat\b|\bfat\s+(?:pad|graft|necrosis)\b/i
  }
];

/**
 * Word-by-word rather than the first match, because a note can contain both.
 *
 * "Gross debridement completed; patient was disgusting about it" must still fire.
 * Matching once and testing the whole note for clinical context would let the
 * legitimate phrase excuse the slur sitting beside it.
 */
function isClinicalUse(text: string, match: RegExpExecArray, clinical?: RegExp): boolean {
  if (!clinical) return false;
  // A window either side of the hit, so the context test sees the phrase and not
  // the rest of the note. 40 characters comfortably spans "buccal fat pad" and
  // "lies distal to tooth 14" without reaching the next sentence.
  const from = Math.max(0, match.index - 40);
  const window = text.slice(from, match.index + match[0].length + 40);
  return clinical.test(window);
}

export function runProfessionalToneRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const rule of RUDE) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null = null;
    // Walk every hit until one is NOT explained by clinical context. A note whose
    // only "fat" is a buccal fat pad reports nothing; a note that also calls a
    // person fat still reports.
    for (let hit = re.exec(text); hit; hit = re.exec(text)) {
      if (!isClinicalUse(text, hit, rule.clinical)) {
        m = hit;
        break;
      }
    }
    if (!m) continue;
    findings.push({
      ruleId: "effort.unprofessional",
      category: "stigmatizing",
      severity: "S1",
      message:
        `"${m[0]}" reads as ${rule.display}. A note documents the visit, never characterizes ` +
        `the person — and this exact wording is what gets projected in front of a jury.`,
      matchedText: m[0],
      suggestion:
        "State the observable behavior or clinical finding instead: what was said, what was " +
        "seen, what was measured.",
      occurrences: 1
    });
  }
  return findings;
}

export function runEffortRules(text: string): AuditFinding[] {
  return [...runGibberishRule(text), ...runProfessionalToneRule(text)];
}
