import type { AuditFinding } from "../types";
import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { STIGMATIZING_PHRASES, VAGUE_PHRASES } from "@/lib/vocab/vague-phrases";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Is this initialism already written in the defined form the house style asks
 * for — "root canal therapy (RCT)" — somewhere in the text?
 *
 * Without this the audit contradicted both the standardizer and itself. The
 * standardizer expands an initialism on first use into exactly that shape, the
 * route then audits the standardizer's OUTPUT, and this rule flagged the
 * result at REVIEW severity — so pressing Standardize could only ever increase
 * the finding count, and the tool told the clinician to fix wording it had just
 * written to its own convention. A term that has been defined is the goal
 * state, not a defect.
 */
export function definedInText(text: string, matched: string): boolean {
  // Matched on the CONVENTION rather than on one exact phrasing: an initialism
  // in parentheses, immediately after at least two words of prose, is a
  // definition. Comparing against the table's `replacement` string does not
  // work, because that field is guidance ("no known drug allergies or no known
  // allergies, only when verified") rather than a single canonical expansion,
  // and a writer's own correct wording will rarely match it verbatim.
  return new RegExp(
    `(?:[A-Za-z][A-Za-z-]*\\s+){2,10}\\(${escapeRegExp(matched)}\\)`
  ).test(text);
}

export function runAbbreviationRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const abbr of BANNED_ABBREVIATIONS) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(abbr.pattern)) {
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      if (definedInText(text, matched)) continue;
      findings.push({
        ruleId: `abbrev.${abbr.id}`,
        category: "abbreviation",
        severity: abbr.severityClass === "style" ? "S3" : "S2",
        message: `Replace the shorthand "${matched}".`,
        matchedText: matched,
        suggestion: abbr.replacement,
        occurrences: count
      });
    }
  }
  return findings;
}

export function runVaguePhraseRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const phrase of VAGUE_PHRASES) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(phrase.pattern)) {
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      findings.push({
        ruleId: `vague.${phrase.id}`,
        category: "vague-phrase",
        severity: "S2",
        message: `"${matched}" is vague or unsafe wording. A clinician supplies the specific fact.`,
        matchedText: matched,
        suggestion: phrase.replacement,
        occurrences: count
      });
    }
  }
  return findings;
}

/**
 * Language that labels the patient rather than describing the care.
 *
 * Separate from the vague-phrase rule because it is a different defect. A
 * vague note is missing a fact; a stigmatizing note may state every fact
 * correctly and still describe a person in terms they would not recognise as
 * fair. Under the 21st Century Cures Act the patient reads this.
 *
 * STYLE severity, always. It never blocks and it is never auto-applied: the
 * right wording depends on what actually happened, and substituting a kinder
 * word for a clinically meaningful one would be this tool inventing content —
 * the one thing it must not do.
 */
export function runStigmatizingRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const phrase of STIGMATIZING_PHRASES) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(phrase.pattern)) {
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      findings.push({
        ruleId: `stigma.${phrase.id}`,
        category: "stigmatizing",
        severity: "S3",
        message: `"${matched}" labels the patient. Patients read these notes; a clinician decides the wording.`,
        matchedText: matched,
        suggestion: phrase.replacement,
        occurrences: count
      });
    }
  }
  return findings;
}
