import type { AuditFinding } from "../types";
import { PLAIN_WORDS } from "@/lib/vocab/plain-language";
import { definedInText } from "./terminology";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Has the writer already explained the term in the sentence?
 *
 * Two forms count, because both are good writing and the house standard uses
 * the first:
 *
 *   periodontitis (gum disease that has reached the bone)   <- explained here
 *   gum disease (periodontitis)                             <- definedInText
 *
 * The second form is the one the abbreviation rule already recognises, so it is
 * reused rather than reimplemented — the two rules agreeing about what a
 * definition looks like is the point.
 *
 * A term the writer has explained is the goal state. Flagging it anyway would
 * push a clinician to delete the explanation to clear the finding, which is the
 * exact opposite of what this rule is for.
 */
function explainedInText(text: string, matched: string): boolean {
  // At least four characters inside the parentheses: "(x)" is not an
  // explanation, and a tooth number in brackets certainly is not.
  if (new RegExp(`${escapeRegExp(matched)}\\s*\\([^)]{4,}\\)`, "i").test(text)) return true;
  return definedInText(text, matched);
}

/**
 * Words the patient cannot use, in text written for the patient.
 *
 * STYLE severity, always, and never auto-applied. A plainer word can carry a
 * different clinical claim, and picking the wording that stays true is the
 * clinician's job — this rule only points.
 *
 * Called from the FIELD walk in runAudit, never from runTextAudit. Running it
 * over the whole composed note would flag the clinical record for being
 * clinical, which would bury every real finding under a hundred style rows.
 */
export function runPlainLanguageRule(
  text: string,
  fieldRef: { moduleId: string; fieldId: string }
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const word of PLAIN_WORDS) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(word.pattern)) {
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      if (explainedInText(text, matched)) continue;
      findings.push({
        ruleId: `plain.${word.id}`,
        category: "plain-language",
        severity: "S3",
        message: `"${matched}" is written for a clinician. This text is written for the patient.`,
        fieldRef,
        matchedText: matched,
        suggestion: `${word.replacement} — or keep the term and explain it once, like "${matched} (${word.replacement})"`,
        occurrences: count
      });
    }
  }
  return findings;
}
