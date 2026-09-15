import type { AuditFinding } from "../types";
import { STALE_PHRASES } from "@/lib/vocab/vague-phrases";
import { MASK_TOKEN_PATTERN } from "../maskPhi";

// Template-residue checks from the formal audit pass: unresolved
// placeholders, markers, stale copy-forward wording, duplicate sentences.

const RESIDUE_PATTERNS: { id: string; pattern: RegExp; message: string }[] = [
  {
    // Neither delimiter may sit against whitespace, so a pair of measurement
    // inequalities ("depth <3mm and recession >2mm") is not mistaken for a
    // placeholder while "<value>" and "<0-10>" still are.
    id: "residue.angle-placeholder",
    pattern: /<[^<>\s](?:[^<>\n]{0,78}[^<>\s])?>/g,
    message: "Unresolved placeholder. Replace it with the fact, or mark the item not assessed, not applicable, unknown, or unresolved."
  },
  {
    id: "residue.square-brackets",
    pattern: /\[[^\][\n]{0,80}\]/g,
    message: "Bracketed template text remains. Resolve it before the note leaves the tool."
  },
  {
    id: "residue.braces",
    pattern: /\{[^{}\n]{0,80}\}/g,
    message: "Braced template text remains. Resolve it before the note leaves the tool."
  },
  {
    id: "residue.underscores",
    pattern: /_{3,}/g,
    message: "A fill-in blank remains. Enter the fact or mark its state."
  },
  {
    id: "residue.empty-quotes",
    pattern: /""|''/g,
    message: "Empty quotation marks remain. Enter the quoted words or remove the quotes."
  },
  {
    id: "residue.tbd",
    pattern: /\b(?:TBD|TODO)\b/gi,
    message: "A TBD or TODO marker remains. Resolve it before the note leaves the tool."
  }
];

// A redaction token is FINISHED content, not residue.
//
// This rule exists to catch a placeholder nobody filled in — "[patient name]",
// "[date]". A mask token is the opposite: a clinician looked at a flagged
// identifier and deliberately replaced it. Without this exemption, masking
// left the note with S1 findings, and S1 blocks email — so taking the safe
// option made the note unfileable and pushed the clinician straight back to
// waiving the privacy stop, which is the behaviour masking exists to replace.
//
// Anchored to the exact token shape, so "[anything else]" is still residue.
function isMaskToken(matched: string): boolean {
  return new RegExp(`^${MASK_TOKEN_PATTERN.source}$`).test(matched);
}

export function runResidueRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const p of RESIDUE_PATTERNS) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(p.pattern)) {
      if (isMaskToken(m[0])) continue;
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      findings.push({
        ruleId: p.id,
        category: "template-residue",
        severity: "S1",
        message: p.message,
        matchedText: matched,
        occurrences: count
      });
    }
  }
  for (const p of STALE_PHRASES) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(p.pattern)) {
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      findings.push({
        ruleId: `stale.${p.id}`,
        category: "stale-text",
        severity: "S2",
        message: `Possible copy-forward or stale wording: "${p.display}". A clinician confirms it was written for this visit.`,
        matchedText: matched,
        suggestion: p.replacement,
        occurrences: count
      });
    }
  }
  // Duplicate sentences (>= 40 chars) suggest copy-forward inside the draft.
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-#*\s]+/, "").trim().toLowerCase())
    .filter((s) => s.length >= 40);
  const counts = new Map<string, number>();
  for (const s of sentences) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const [sentence, count] of counts) {
    if (count > 1) {
      findings.push({
        ruleId: "residue.duplicate-sentence",
        category: "duplicate-text",
        severity: "S2",
        message:
          "The same sentence appears more than once. A clinician confirms each instance belongs where it is.",
        matchedText: sentence.slice(0, 80),
        occurrences: count
      });
    }
  }
  return findings;
}
