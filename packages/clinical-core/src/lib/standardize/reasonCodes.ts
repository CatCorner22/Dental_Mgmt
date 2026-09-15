/**
 * Reason codes for finding attestations and PHI overrides.
 *
 * Free text alone is not aggregable for Team Lead / carrier QA. A required
 * code plus optional prose keeps the substance bar and makes categories
 * countable later. Finding attestations stay client-session state; PHI codes
 * ride inside the existing frozen `phiOverride.reason` string.
 *
 * `rule-disagreement` is NOT an attest code — that path is Escalate → wish.
 *
 * See knowledge/sources/high-stakes-documentation-patterns.md §2 / §6.
 */

import { isValidPhiAttestation } from "@/lib/audit/attestation";

export type FindingAttestCode =
  | "correct-as-written"
  | "patient-quote"
  | "practice-standard-term";

export type PhiOverrideCode =
  | "clinical-value"
  | "tooth-or-site-numbers"
  | "device-lot-or-serial"
  | "other-not-identifier";

export interface ReasonCodeOption<C extends string> {
  code: C;
  label: string;
  /** Frozen / recorded sentence when prose is omitted — must clear the substance bar alone. */
  template: string;
}

export const FINDING_ATTEST_CODES: readonly ReasonCodeOption<FindingAttestCode>[] = [
  {
    code: "correct-as-written",
    label: "Correct as written",
    template: "Correct as written: the flagged wording matches what was observed."
  },
  {
    code: "patient-quote",
    label: "Patient quote / reported speech",
    template: "Patient quote: the flagged wording is reported speech, not a clinical claim."
  },
  {
    code: "practice-standard-term",
    label: "Practice standard term",
    template: "Practice standard term: this wording is the approved office phrasing."
  }
];

export const PHI_OVERRIDE_CODES: readonly ReasonCodeOption<PhiOverrideCode>[] = [
  {
    code: "clinical-value",
    label: "Clinical value / measurement",
    template: "Clinical measurement or value, not a patient identifier or date."
  },
  {
    code: "tooth-or-site-numbers",
    label: "Tooth or site numbers",
    template: "Tooth or site numbers in the chart, not a date or record ID."
  },
  {
    code: "device-lot-or-serial",
    label: "Device lot or serial",
    template: "Device lot or serial number, not a patient identifier."
  },
  {
    code: "other-not-identifier",
    label: "Other — not an identifier",
    template: "Reviewed carefully: not a patient identifier, exact date, contact, or record number."
  }
];

const CODE_PREFIX = /^\[([a-z0-9-]+)\]\s*/i;

export function formatReasonCode(code: string, prose?: string): string {
  const extra = (prose ?? "").trim();
  return extra ? `[${code}] ${extra}` : `[${code}]`;
}

export function parseReasonCode(reason: string): { code: string | null; prose: string } {
  const trimmed = reason.trim();
  const m = trimmed.match(CODE_PREFIX);
  if (!m) return { code: null, prose: trimmed };
  return { code: m[1].toLowerCase(), prose: trimmed.slice(m[0].length).trim() };
}

function optionFor<C extends string>(
  list: readonly ReasonCodeOption<C>[],
  code: string
): ReasonCodeOption<C> | undefined {
  return list.find((o) => o.code === code);
}

/** Expand a finding-attest selection into the string stored in client state. */
export function composeFindingAttestation(
  code: FindingAttestCode,
  prose?: string
): string {
  const opt = optionFor(FINDING_ATTEST_CODES, code);
  if (!opt) return formatReasonCode(code, prose);
  const extra = (prose ?? "").trim();
  if (!extra) return formatReasonCode(code, opt.template);
  return formatReasonCode(code, extra);
}

/** Expand a PHI override selection into the frozen reason string. */
export function composePhiOverrideReason(code: PhiOverrideCode, prose?: string): string {
  const opt = optionFor(PHI_OVERRIDE_CODES, code);
  if (!opt) return formatReasonCode(code, prose);
  const extra = (prose ?? "").trim();
  if (!extra) return formatReasonCode(code, opt.template);
  return formatReasonCode(code, `${opt.template} ${extra}`);
}

export function isValidFindingAttestSelection(
  code: FindingAttestCode | "",
  prose: string
): boolean {
  if (!code) return false;
  if (!FINDING_ATTEST_CODES.some((o) => o.code === code)) return false;
  const composed = composeFindingAttestation(code, prose);
  // When the writer adds prose, it must still clear the substance bar on its own
  // (or with the code prefix). Template-only always passes by construction.
  if ((prose ?? "").trim()) return isValidPhiAttestation(composed) || isValidPhiAttestation(prose);
  return isValidPhiAttestation(composed);
}

export function isValidPhiOverrideSelection(
  code: PhiOverrideCode | "",
  prose: string,
  checked: boolean
): boolean {
  if (!checked || !code) return false;
  if (!PHI_OVERRIDE_CODES.some((o) => o.code === code)) return false;
  return isValidPhiAttestation(composePhiOverrideReason(code, prose));
}

/** Short display for a stored reason (chip / recorded line). */
export function displayReasonCode(reason: string): string {
  const { code, prose } = parseReasonCode(reason);
  if (!code) return reason;
  const finding = optionFor(FINDING_ATTEST_CODES, code);
  const phi = optionFor(PHI_OVERRIDE_CODES, code);
  const label = finding?.label ?? phi?.label ?? code;
  if (!prose) return label;
  // Avoid duplicating the template in the UI when that is all that was stored.
  if (finding && prose === finding.template) return label;
  if (phi && prose.startsWith(phi.template)) {
    const rest = prose.slice(phi.template.length).trim();
    return rest ? `${label}: ${rest}` : label;
  }
  return `${label}: ${prose}`;
}
