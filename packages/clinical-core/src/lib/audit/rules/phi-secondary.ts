import type { AuditFinding } from "../types";

// SECOND-LINE PHI SCAN — additive blocks before any provider call.
//
// runPhiRule remains the filing audit authority. This module catches extra
// identifier shapes that must never leave the practice for AI, without
// changing filing severity for patterns that are noisy in operatory notes.
//
// Optional ScanPhiFn injection lets tests (and a future local ONNX de-ID
// model) add findings; the model may only ADD blocks, never clear a rule hit.

export type ScanPhiFn = (text: string) => AuditFinding[];

interface SecondaryPattern {
  id: string;
  pattern: RegExp;
  message: string;
}

const SECONDARY: SecondaryPattern[] = [
  {
    id: "phi.email-address",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    message: "This looks like an email address. Remove it before any AI call. Contact details belong only in the EDR."
  },
  {
    id: "phi.mrn-label",
    pattern: /\b(?:MRN|medical\s*record\s*(?:no|number|#)|chart\s*(?:no|number|#))\s*[:#]?\s*[A-Z0-9-]{4,}\b/gi,
    message: "This looks like a medical record number. Remove it before any AI call."
  },
  {
    id: "phi.street-address",
    pattern:
      /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Drive|Dr|Ln|Lane|Ct|Court)\b\.?/g,
    message: "This looks like a street address. Remove it before any AI call."
  },
  {
    id: "phi.zip-plus-city",
    pattern: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g,
    message: "This looks like a city/state/ZIP. Remove it before any AI call."
  }
];

/** Deterministic second-line patterns (no model). */
export function runPhiSecondary(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const p of SECONDARY) {
    const re = new RegExp(p.pattern.source, p.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      findings.push({
        ruleId: p.id,
        category: "phi",
        severity: "S0",
        message: p.message,
        matchedText: m[0],
        occurrences: 1
      });
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  return findings;
}

/**
 * Merge primary PHI findings with second-line (and optional model) findings.
 * Dedupes by ruleId + matchedText. Never removes a primary finding.
 */
export function mergePhiScans(
  primary: AuditFinding[],
  secondary: AuditFinding[],
  modelExtra: AuditFinding[] = []
): AuditFinding[] {
  const out: AuditFinding[] = [];
  const seen = new Set<string>();
  for (const f of [...primary, ...secondary, ...modelExtra]) {
    if (f.category !== "phi") continue;
    const key = `${f.ruleId}|${f.matchedText ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/**
 * Provider-bound PHI gate: primary rules + second-line + optional injected scanner.
 * Filing audit continues to call runPhiRule alone.
 */
export function scanPhiForProvider(
  text: string,
  primary: AuditFinding[],
  modelScan?: ScanPhiFn
): AuditFinding[] {
  const secondary = runPhiSecondary(text);
  const modelExtra = modelScan ? modelScan(text) : [];
  return mergePhiScans(primary, secondary, modelExtra);
}
