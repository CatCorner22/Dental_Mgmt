import type { AuditReport } from "@/lib/audit/types";
import { SEVERITY_LABELS, statusLabel } from "@/lib/audit/types";
import type { ModuleDef } from "@/lib/schema/types";
import { MODULES_BY_ID } from "@/lib/modules";
import { RULESET_VERSION } from "@/lib/version";
import { visibleText } from "@/lib/audit/attestation";

export const AUDIT_VERSION = `deterministic-checker ${RULESET_VERSION}`;

function ownerFor(severity: string): string {
  if (severity === "S3") return "staff";
  if (severity === "S4") return "office workflow";
  return "clinician";
}

// Every cell carries arbitrary note prose — the duplicate-sentence rule puts up
// to 80 characters of whatever the clinician typed into the Location column.
//
// This escaped `|` and `\n` but not `\r` or backticks. A lone carriage return
// is a line ending to a markdown renderer, so note text containing "\r```"
// landed a fence at column 0: the Issues table ended early and the rest of the
// document — Terms changed, the Draft note, the EDR finalization checklist —
// was swallowed into a code block. In the app that is invisible (history
// renders frozen text in a <pre>), but the frozen .md is emailed as an
// attachment and opened in real markdown viewers, which is exactly where the
// legal record needs to survive intact.
//
// All line endings collapse, and backticks are neutralized so no fence can
// open from inside a cell.
function cell(text: string): string {
  return (
    text
      .replace(/\|/g, "\\|")
      .replace(/[\r\n\u2028\u2029]+/g, " ")
      .replace(/`/g, "'")
      // "<" was the gap. The duplicate-sentence rule copies up to 80
      // characters of arbitrary note prose into the Location column, so a
      // typed "<span style="display:none" >" rendered as a LIVE hidden span
      // and the rest of the cell \u2014 the finding's own evidence \u2014 disappeared
      // from the row meant to prove it.
      .replace(/</g, "\\<")
  );
}

export interface PhiAttestation {
  stops: number;
  reason: string;
  attestedBy: string;
}

// User prose entering a frozen legal document: newlines collapsed so it cannot
// forge a heading or a second section, length bounded, pipes escaped in case
// it is ever moved into a table. The same shape of defense the select-value
// validator uses against a forged "## Submission record".
function frozenLine(text: string): string {
  // visibleText FIRST: zero-width and bidi format characters are not \s, so
  // without this a reason made of them survives the collapse and the record's
  // "Reason given:" line renders blank — an attestation nobody can read is not
  // an attestation. The validator strips the same set, so what was checked is
  // what is written.
  const clean = visibleText(text).replace(/\s+/g, " ").replace(/\|/g, "\\|").replace(/</g, "\\<").trim();
  // Truncation is MARKED. The submit route validates and logs 500 characters
  // and this wrote 300 silently, so a long attestation appeared complete in
  // the frozen record while saying something different from the audit log —
  // and a reason tuned to end on a sentence boundary read as a whole, other
  // statement. A record that quietly drops half a sworn statement is worse
  // than one that admits the cut.
  return clean.length > 300 ? `${clean.slice(0, 300)}… [truncated; full text in the audit log]` : clean;
}

// Matches the "Audit output" format in the formal audit pass
// (skill/assets/dental-note-templates.md). Never a percentage or score.
export function composeAuditReport(
  report: AuditReport,
  activeModules: ModuleDef[],
  draft: string,
  phiAttestation?: PhiAttestation
): string {
  const lines: string[] = [
    "# Dental-note audit",
    "",
    `- Status: ${statusLabel(report.status)}`,
    "- Rule profile: national + Tennessee",
    `- Modules confirmed: ${activeModules.map((m) => m.title).join("; ")}`,
    `- Audit version: ${AUDIT_VERSION}`,
    "",
    "## Issues",
    "",
    "| ID | Severity | Module | Location | Finding | Required action | Owner |",
    "|---|---|---|---|---|---|---|"
  ];

  report.findings.forEach((f, i) => {
    const moduleTitle = f.fieldRef
      ? (MODULES_BY_ID.get(f.fieldRef.moduleId)?.title ?? f.fieldRef.moduleId)
      : "note text";
    const location = f.fieldRef
      ? f.fieldRef.fieldId
      : f.matchedText
        ? `"${f.matchedText}"`
        : "—";
    const action = f.suggestion ? `Use: ${f.suggestion}` : f.message;
    lines.push(
      `| ${i + 1} | ${f.severity} ${SEVERITY_LABELS[f.severity]} | ${cell(moduleTitle)} | ${cell(
        location
      )} | ${cell(f.message)} | ${cell(action)} | ${ownerFor(f.severity)} |`
    );
  });
  if (report.findings.length === 0) {
    lines.push("| — | — | — | — | No finding from the deterministic checker. | Clinician review still required. | clinician |");
  }

  // The waiver goes INTO the frozen record, not only into the audit log. This
  // is the one safety gate a person can override, and before this the filed
  // document itself read as though the stops had simply been resolved — the
  // attestation lived in a log table most readers will never open. A legal
  // record that omits "a human overrode the privacy screen, and said why"
  // is not a record of what happened.
  if (phiAttestation) {
    lines.push(
      "",
      "## Privacy stops overridden by attestation",
      "",
      `- Stops overridden: ${phiAttestation.stops}`,
      `- Attested by: ${frozenLine(phiAttestation.attestedBy)}`,
      `- Reason given: ${frozenLine(phiAttestation.reason)}`,
      "",
      "The flagged text remains in the note below exactly as written. The attestation is the signer's statement that none of it identifies a person; the checker's findings above stand as findings."
    );
  }

  lines.push(
    "",
    "## Terms changed",
    "",
    "| Before | After | Rule | Clinician confirmation needed |",
    "|---|---|---|---|",
    "| — | — | This tool never changes clinical text. Suggestions above are applied only by a person. | — |",
    "",
    "## Draft note",
    "",
    draft,
    "",
    "## EDR-only finalization",
    "",
    "- [ ] Correct chart confirmed locally",
    "- [ ] Dates, times, identities, authority, and signatures completed locally",
    "- [ ] Linked records reconciled",
    "- [ ] Every issue resolved or given a clinician-approved disposition",
    "- [ ] Licensed clinician compared every fact with the source and signed",
    "",
    "The deterministic checker screens possible identifiers, placeholders, controlled typos, ambiguous abbreviations, vague phrases, duplicate text, selected contradictions, ADA Universal tooth values, and surfaces. It does not replace the semantic audit or clinician review."
  );
  return lines.join("\n");
}
