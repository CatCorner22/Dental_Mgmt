// PRECISION: how often the audit stops a note that was already fine.
//
// The number this file produces is the one that decides whether the audit panel
// keeps working. Recall failures degrade gracefully — a missed defect is a defect
// that would have been missed anyway without the tool. Precision failures do not:
// a clinician blocked on a correct note learns the panel is noise, and after that
// the ruleset can catch everything and change nothing, because nobody reads it.
//
// WHY ZERO RATHER THAN A PERCENTAGE. The obvious target was "98 or 99 percent
// accurate". For findings that BLOCK, that is the wrong shape:
//
//   - 98 percent precision means one good note in fifty is stopped. At twenty
//     notes a day that is a false block every two or three days, which is exactly
//     the cadence that teaches a person to route around a control.
//   - A percentage over thirty notes is theatre. Ninety-eight and one hundred
//     differ by a single note, so the decimal would imply a resolution the sample
//     cannot support.
//   - The repository already has this instinct: assist/evals/scorer.test.ts gates
//     on falseRefusalRate <= 0, not <= 0.02.
//
// So blocking findings are held at zero and the rigour comes from the BREADTH of
// the corpus instead — see clean-corpus.ts, where every note is deliberately
// loaded with a hazard known to break a specific rule. "Zero false blocks across
// notes chosen to break these rules" is a far stronger claim than a decimal over
// whatever text happened to be lying around.
//
// Advisory findings (S2 to S4) get a rate instead, because some noise there is
// tolerable and the volume makes a rate mean something.

import { runTextAudit } from "../engine";
import type { AuditFinding, Severity } from "../types";
import { CLEAN_CORPUS, type CleanNote, type Hazard } from "./clean-corpus";

/**
 * The severities that actually stop work.
 *
 * S0 blocks copy, download, and email; S1 additionally blocks email. S2 says
 * "worth a look before you file" and blocks nothing on the builder path, so it
 * is measured as advisory noise rather than as a false stop.
 *
 * One caveat worth carrying: standardize/resolution.ts treats S2 as blocking on
 * the standardizer path. A bare-name S2 is therefore non-blocking in one surface
 * and blocking in another. This harness measures the builder's gate; if that
 * divergence persists, advisory noise matters more than the ceiling implies.
 */
const BLOCKING: readonly Severity[] = ["S0", "S1"];

export interface FalsePositive {
  noteId: string;
  ruleId: string;
  severity: Severity;
  matchedText?: string;
  /** The corpus note's own explanation, so a failure reads as a sentence. */
  why: string;
}

export interface PrecisionReport {
  notes: number;
  /**
   * Blocking findings raised on text that is correct by construction. Every entry
   * is a note the tool would have stopped for no reason. Target: none.
   */
  blockingFalsePositives: FalsePositive[];
  /** Advisory findings per note, averaged. Tolerated, ratcheted, not zero. */
  advisoryPerNote: number;
  /** Which hazards the corpus actually exercises — the anti-vacuity input. */
  hazardsCovered: Hazard[];
}

/**
 * Count distinct (note, rule, matched text) triples rather than raw findings.
 *
 * One string can legitimately produce several findings: "Dr. John Smith" raises
 * both phi.name at S0 and phi.name-bare at S2, and the seven date patterns
 * overlap on a single run of digits. Counting raw findings would inflate the
 * number and, worse, would make a single narrowing look like it fixed several
 * problems.
 */
function key(noteId: string, f: AuditFinding): string {
  return `${noteId}|${f.ruleId}|${f.matchedText ?? ""}`;
}

/**
 * Run the text-level audit over notes that should pass it.
 *
 * `runTextAudit` rather than `runAudit` on purpose: required.missing and the
 * completeness rules fire from module state, and an empty required field is not
 * a false positive — it is the rule working. The false positives live in the
 * rules that read prose, which is exactly what runTextAudit covers.
 *
 * The audit function is injectable so a candidate ruleset can be scored against
 * the same frozen corpus before it is promoted, matching the seam in
 * standardize/disambiguation-eval.ts.
 */
export function runPrecisionEval(
  corpus: readonly CleanNote[] = CLEAN_CORPUS,
  audit: (text: string) => AuditFinding[] = runTextAudit
): PrecisionReport {
  const blocking = new Map<string, FalsePositive>();
  const hazards = new Set<Hazard>();
  let advisory = 0;

  for (const note of corpus) {
    for (const hazard of note.hazards) hazards.add(hazard);

    const seenAdvisory = new Set<string>();
    for (const finding of audit(note.text)) {
      const k = key(note.id, finding);
      if ((BLOCKING as readonly string[]).includes(finding.severity)) {
        if (!blocking.has(k)) {
          blocking.set(k, {
            noteId: note.id,
            ruleId: finding.ruleId,
            severity: finding.severity,
            matchedText: finding.matchedText,
            why: note.why
          });
        }
      } else if (!seenAdvisory.has(k)) {
        seenAdvisory.add(k);
        advisory++;
      }
    }
  }

  return {
    notes: corpus.length,
    blockingFalsePositives: [...blocking.values()].sort(
      (a, b) => a.noteId.localeCompare(b.noteId) || a.ruleId.localeCompare(b.ruleId)
    ),
    advisoryPerNote: corpus.length === 0 ? 0 : Math.round((advisory / corpus.length) * 100) / 100,
    hazardsCovered: [...hazards].sort()
  };
}

/**
 * A failure has to be readable at 5pm by someone who did not write this file.
 *
 * So: the note, the rule, the exact span, and the corpus note's own sentence
 * saying why that text is legitimate — because the first question on seeing a
 * failure is "is this actually a false positive, or is my corpus wrong?", and
 * the answer should be on the screen rather than three files away.
 */
export function formatFalsePositives(report: PrecisionReport): string {
  if (report.blockingFalsePositives.length === 0) return "no blocking false positives";
  return [
    `${report.blockingFalsePositives.length} blocking finding(s) on notes that are correct:`,
    ...report.blockingFalsePositives.map(
      (f) =>
        `  ${f.noteId} — ${f.ruleId} (${f.severity}) matched ${JSON.stringify(f.matchedText ?? "")}\n` +
        `      the note is legitimate because: ${f.why}`
    )
  ].join("\n");
}
