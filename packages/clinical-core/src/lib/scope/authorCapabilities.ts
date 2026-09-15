// AUTHOR CAPABILITIES — TN license authority mapped onto what Smile Notes
// offers a signed-in writer.
//
// The enforcement half already lives in clinicalRoles.ts (Assessment/Plan
// write lock) and approval.ts (filing). This module is the TEMPLATE and
// COACHING half: which visit scaffolds to offer, which add-on modules to
// surface, and which SuperByte / Byte / audit lenses fit the writer's
// license — without inventing a second RBAC ladder.
//
// Sources: Tenn. Code Ann. § 63-5-108; Tenn. Comp. R. & Regs. 0460-03 / 0460-04;
// LICENSE_SCOPES in law/license-scope.ts. Training charts remain the citation
// surface; this file only drives product behaviour.

import {
  canRecordClinicalJudgement,
  CLINICAL_ROLE_LABEL,
  type ClinicalRole
} from "@/lib/auth/clinicalRoles";
import { DENTIST_FILED_MODULE_IDS } from "@/lib/auth/approval";
import type { LicenseLevel } from "@/lib/law/license-scope";

/** Modules that document dentist-level acts end-to-end — same set as filing. */
export const DENTIST_SCOPED_MODULE_IDS: ReadonlySet<string> = DENTIST_FILED_MODULE_IDS;

/**
 * Modules that imply diagnosis, surgical planning, or permanent restorative
 * judgement a hygienist should not start from a Quick Pick. Assistants may
 * still open restorative modules when documenting chairside assistance.
 */
export const HYGIENIST_HIDDEN_MODULE_IDS: ReadonlySet<string> = new Set([
  ...DENTIST_SCOPED_MODULE_IDS,
  "implant",
  "robotic-surgery",
  "bone-graft-sinus",
  "biopsy",
  "fixed-prosthodontic",
  "endodontic",
  "operative",
  "extraction"
]);

export interface AuthorCapabilityProfile {
  role: ClinicalRole;
  label: string;
  /** LICENSE_SCOPES id for chart linkage; null when role is unset. */
  licenseLevel: LicenseLevel | null;
  mayRecordJudgement: boolean;
  /** SuperByte lens — objective; never coaches illegal authorship. */
  bytestarLens: string;
  /** Byte knowledge: which authorScopes an entry may target (plus "any"). */
  advisorScope: "any" | "hygienist" | "assistant" | "dentist" | "auxiliary";
  /** Featured quick-pick ids for the dashboard (order preserved). */
  featuredPickIds: readonly string[];
  /** One-line structure cue shown near Quick picks. */
  structureCue: string;
  /**
   * Whether this licence reaches the model half of assist, or only the
   * deterministic twin of each capability. See lib/assist/tier.ts.
   *
   * "unset" is deterministic, and that is a DELIBERATE break with the
   * permissive default the rest of this file uses. Everywhere else, not knowing
   * someone's licence means not restricting them — the accurate statement about
   * an unrecorded account is "we have not been told", which is no grounds to
   * refuse a clinician their own work. Here the calculus inverts: the thing
   * being withheld is a model's opinion, the fallback still answers the
   * question, and handing generated clinical prose to an account whose scope
   * nobody has stated is the one direction that cannot be undone.
   */
  assistTier: "predictive" | "deterministic";
}

const PROFILES: Record<ClinicalRole, AuthorCapabilityProfile> = {
  unset: {
    role: "unset",
    assistTier: "deterministic",
    label: CLINICAL_ROLE_LABEL.unset,
    licenseLevel: null,
    mayRecordJudgement: true,
    bytestarLens:
      "Author clinical role is not recorded on this account. Observe documentation completeness for a Tennessee dental record without assuming who may diagnose or treatment-plan.",
    advisorScope: "any",
    featuredPickIds: ["recall-exam", "restorative", "simple-extraction", "emergency"],
    structureCue:
      "Record each person's clinical role in User admin so templates match license scope."
  },
  hygienist: {
    role: "hygienist",
    assistTier: "predictive",
    label: CLINICAL_ROLE_LABEL.hygienist,
    licenseLevel: "dental-hygienist",
    mayRecordJudgement: false,
    bytestarLens:
      "AUTHOR LICENSE: dental hygienist. The writer may document hygiene findings, measurements, preventive/therapeutic hygiene services, and patient education FOR DIAGNOSIS BY THE DENTIST. Do not coach the writer to author a diagnosis, comprehensive examination conclusion, or treatment plan. Prefer questions that close hygiene documentation loops (probing, bleeding, services rendered, fluoride, teach-back, supervision/patient-status when relevant). Flag dentist-owned sections only as open for the dentist.",
    advisorScope: "hygienist",
    featuredPickIds: ["hygiene-prophy", "hygiene-periodontal", "recall-exam", "perio-srp"],
    structureCue:
      "Hygiene scaffolds keep findings and services in Objective; Assessment and Plan stay for the dentist."
  },
  assistant: {
    role: "assistant",
    assistTier: "predictive",
    label: CLINICAL_ROLE_LABEL.assistant,
    licenseLevel: "registered-dental-assistant",
    mayRecordJudgement: false,
    bytestarLens:
      "AUTHOR LICENSE: dental assistant. The writer may document what they performed and observed under dentist direction. Do not coach diagnosis, treatment planning, or independent examination conclusions. Prefer questions about procedure assistance, materials used, patient comfort observations, and clear attribution of who performed each act.",
    advisorScope: "assistant",
    featuredPickIds: ["assistant-chairside", "restorative", "simple-extraction", "emergency"],
    structureCue:
      "Chairside scaffolds emphasize what you did and saw; leave diagnosis and plan for the dentist."
  },
  dentist: {
    role: "dentist",
    assistTier: "predictive",
    label: CLINICAL_ROLE_LABEL.dentist,
    licenseLevel: "dentist",
    mayRecordJudgement: true,
    bytestarLens:
      "AUTHOR LICENSE: dentist. The writer may document diagnosis and treatment planning. Prefer observations that close clinical loops: rationale, consent decision, radiographic interpretation, disposition of findings, and follow-up.",
    advisorScope: "dentist",
    featuredPickIds: ["dentist-exam", "restorative", "simple-extraction", "emergency"],
    structureCue:
      "Exam and operative scaffolds include Assessment and Plan — your judgement sections."
  },
  // The product's own developer tier. Not a Tennessee credential, which is why
  // licenseLevel is null: LicenseScopeCard renders nothing for it rather than
  // showing a chart row that would assert a licence this account does not hold.
  //
  // It is unrestricted on every product gate, because the account exists to
  // exercise the paths a licence closes. The lens says so out loud so SuperByte
  // does not read the absence of a stated licence as a dentist's.
  smilenotes: {
    role: "smilenotes",
    assistTier: "predictive",
    label: CLINICAL_ROLE_LABEL.smilenotes,
    licenseLevel: null,
    mayRecordJudgement: true,
    bytestarLens:
      "AUTHOR LICENSE: none claimed — this is a Smile Notes developer account exercising the tool, not a licensed clinician writing a patient record. Observe documentation completeness for a Tennessee dental record without assuming who may diagnose or treatment-plan, and do not coach as though a credential were on file.",
    advisorScope: "any",
    featuredPickIds: ["recall-exam", "restorative", "simple-extraction", "emergency"],
    structureCue: "Developer account — every scaffold is available, including dentist sections."
  }
};

export function authorCapabilities(role: ClinicalRole): AuthorCapabilityProfile {
  return PROFILES[role] ?? PROFILES.unset;
}

export function clinicalRoleToLicenseLevel(role: ClinicalRole): LicenseLevel | null {
  return authorCapabilities(role).licenseLevel;
}

/** May this role start a note that includes this add-on module? */
export function canAuthorSelectModule(role: ClinicalRole, moduleId: string): boolean {
  if (canRecordClinicalJudgement(role)) return true;
  if (DENTIST_SCOPED_MODULE_IDS.has(moduleId)) return false;
  if (role === "hygienist") return !HYGIENIST_HIDDEN_MODULE_IDS.has(moduleId);
  return true;
}

/**
 * Module rail: hide dentist-filed modules for auxiliaries (they cannot file
 * them). Other modules stay visible so transferred drafts remain workable.
 */
export function moduleVisibleInRail(role: ClinicalRole, moduleId: string): boolean {
  if (canRecordClinicalJudgement(role)) return true;
  return !DENTIST_SCOPED_MODULE_IDS.has(moduleId);
}

/**
 * Completeness / justification rule ids that coach dentist judgement an
 * auxiliary cannot write. Tailored away when Assessment/Plan are empty.
 */
export const DENTIST_JUDGEMENT_RULE_PREFIXES = [
  "justify.",
  "complete.clinical-rationale"
] as const;

export function isDentistJudgementRule(ruleId: string): boolean {
  return DENTIST_JUDGEMENT_RULE_PREFIXES.some((p) => ruleId.startsWith(p));
}
