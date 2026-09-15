import type { AuditFinding } from "../types";

// Billing-narrative readiness: the note as the claim's evidence.
//
// Insurance denials for dental work are routinely upheld not because the work
// was wrong but because the NARRATIVE never states the facts the carrier's
// criteria require. The practice writes no billing codes in this tool (codes
// live in the EDR, under the practice's CDT license) — but the narrative that
// will justify those codes is written HERE, and this is the last place a gap
// is cheap to fix.
//
// Same shape as the completeness rules: a strong procedure trigger, a
// satisfying-evidence pattern, S2 fix-or-attest. The suggestion names the
// carrier criterion in plain words, never a code.

interface JustificationRule {
  id: string;
  /** The note clearly performed or planned this procedure. */
  trigger: RegExp;
  satisfiedBy: RegExp;
  what: string;
  how: string;
}

const RULES: JustificationRule[] = [
  {
    id: "justify.srp-periodontal-evidence",
    trigger: /\bscaling\s+and\s+root\s+planing\b|\bSRP\b/i,
    satisfiedBy:
      /\b[4-9](?:\.\d+)?\s*mm\b[^.\n]{0,80}\b(?:pocket|probing|depth)|\b(?:pocket|probing)\s+depths?\b[^.\n]{0,80}\b[4-9](?:\.\d+)?\s*mm\b|\b(?:bone\s+loss|attachment\s+loss|clinical\s+attachment)\b/i,
    what:
      "Scaling and root planing is documented without the periodontal evidence carriers require.",
    how:
      "Reference the probing depths (4 mm or deeper) and the bone or attachment loss in the " +
      "objective section — the periodontal charting exists; the narrative has to point at it."
  },
  {
    id: "justify.buildup-retention",
    trigger: /\bcore\s+build-?up\b|\bbuild-?up\b[^.\n]{0,40}\b(?:crown|core)\b/i,
    satisfiedBy:
      /\binsufficient\s+(?:retentive\s+)?(?:tooth\s+)?structure\b|\binadequate\s+(?:remaining\s+)?(?:tooth\s+)?structure\b|\bfractured?\b|\bundermined\b|\bless\s+than\s+\d+\s*%?\s*(?:of\s+)?(?:coronal|tooth)\s+structure\b/i,
    what: "A core buildup is documented without the retention narrative carriers look for.",
    how:
      'State why the buildup was needed in the tooth\'s own facts: "insufficient retentive tooth ' +
      'structure remains after caries excavation" or the fracture that removed it.'
  },
  {
    id: "justify.crown-necessity",
    trigger: /\bcrown\s+(?:prep(?:aration)?|placed|seated|delivered|planned)\b|\bprepared?\s+for\s+(?:a\s+)?crown\b/i,
    satisfiedBy:
      /\bfractured?\b|\bcracked?\b|\bcusp\b|\bundermined\b|\bextensive\s+(?:caries|decay|restoration)\b|\bfailed\s+restoration\b|\broot\s+canal|endodontic(?:ally)?\s+treated\b|\bwear\b/i,
    what: "Crown work is documented without the structural necessity stated.",
    how:
      "Name the finding that makes the crown necessary — the fractured cusp, the extent of the " +
      "decay or failed restoration, the endodontic history. The finding is in the exam; the " +
      "narrative has to carry it."
  }
];

export function runJustificationRules(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const rule of RULES) {
    if (!new RegExp(rule.trigger.source, rule.trigger.flags).test(text)) continue;
    if (new RegExp(rule.satisfiedBy.source, rule.satisfiedBy.flags).test(text)) continue;
    findings.push({
      ruleId: rule.id,
      category: "required",
      severity: "S2",
      message: `${rule.what} A claim reviewer reads only what is written here.`,
      suggestion: rule.how,
      occurrences: 1
    });
  }
  return findings;
}
