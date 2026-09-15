// Clinical scope of practice — a SEPARATE axis from the administrative ladder.
//
// src/lib/auth/roles.ts answers "what may this account do to the SYSTEM":
// manage users, read the audit log, file a ticket. That ladder is correct and
// fully tested, and nothing here touches it.
//
// This answers a different question: "what may this person write in a CLINICAL
// RECORD", which in Tennessee is decided by licence rather than by seniority.
// Conflating the two would be wrong in both directions — a Hierarchy Manager
// running the practice's accounts may be an office administrator with no
// licence at all, while a dentist may hold the lowest system role in the app.
//
// Tenn. Comp. R. & Regs. 0460 (summarised in
// skill/references/tennessee-dental-law-summary.md): a hygienist may perform
// clinical examination and record findings FOR DIAGNOSIS BY THE DENTIST, but
// may not independently perform a comprehensive examination, diagnosis, or
// treatment planning. An assistant may document what they did and observed but
// may not exercise a dentist's professional judgement. So a note that records
// an assistant as the author of a diagnosis is not merely untidy; it documents
// an act outside that person's scope.

// "smilenotes" is the one value on this axis that is NOT a Tennessee credential.
// It is the product's own developer tier: an account that must be able to reach
// every path in the app in order to build and check it, including the ones a
// licence would close. It claims no credential — licenseLevel stays null, so the
// scope charts never assert that a developer holds one — and it may only be
// assigned by a Smile Notes Developer, enforced on the server in
// PATCH /api/admin/users/[id].
export type ClinicalRole = "unset" | "assistant" | "hygienist" | "dentist" | "smilenotes";

export const CLINICAL_ROLES: ClinicalRole[] = [
  "unset",
  "assistant",
  "hygienist",
  "dentist",
  "smilenotes"
];

/**
 * The subset a Team Lead or Hierarchy Manager may choose from.
 *
 * The developer tier is deliberately absent: it is not a licence, and handing
 * it out is not a practice-management decision.
 */
export const ASSIGNABLE_CLINICAL_ROLES: ClinicalRole[] = [
  "unset",
  "assistant",
  "hygienist",
  "dentist"
];

/** May this SYSTEM role hand out this clinical role? */
export function canAssignClinicalRole(actorSystemRole: string, target: ClinicalRole): boolean {
  if (target !== "smilenotes") return true;
  return actorSystemRole === "admin";
}

export const CLINICAL_ROLE_LABEL: Record<ClinicalRole, string> = {
  // "Not recorded" rather than "None": the practice has not said yet, which is
  // a different statement from "this person has no clinical role".
  unset: "Not recorded",
  assistant: "Dental assistant",
  hygienist: "Dental hygienist",
  dentist: "Dentist",
  smilenotes: "Smile Notes"
};

export const CLINICAL_ROLE_HINT: Record<ClinicalRole, string> = {
  unset: "No clinical restriction is applied. Record a role to enforce scope of practice.",
  assistant: "May document what they performed and observed. May not record a diagnosis or a treatment plan.",
  hygienist: "May record clinical findings and measurements for diagnosis by the dentist. May not diagnose or treatment-plan.",
  dentist: "May record everything, including diagnosis and treatment planning.",
  smilenotes:
    "Smile Notes Developer tier. Reaches every path in the app for building and checking it. Not a Tennessee credential and not a claim to one."
};

export function isClinicalRole(v: unknown): v is ClinicalRole {
  return typeof v === "string" && (CLINICAL_ROLES as string[]).includes(v);
}

/**
 * The clinical role an account effectively holds, from what is stored and the
 * system role it holds.
 *
 * A Smile Notes Developer with nothing recorded resolves to the developer tier.
 * Derived rather than written into the database on sign-in, for two reasons: a
 * read path that writes is a read path that can fail, and deriving means the
 * tier follows the system role — demote the developer and the tier goes with
 * it, instead of leaving a stale row behind that outranks the account holding
 * it. A developer who genuinely holds a licence can still be set to it
 * explicitly, and that stored value wins.
 *
 * Both server read paths (freshSessionUser and requireRole) go through here, so
 * a page and its API can never disagree about what an account may write.
 */
export function resolveClinicalRole(systemRole: string, stored: unknown): ClinicalRole {
  const role = isClinicalRole(stored) ? stored : "unset";
  if (role === "unset" && systemRole === "admin") return "smilenotes";
  return role;
}

/**
 * Sections whose content is a dentist's professional judgement.
 *
 * Keyed by `${moduleId}.${sectionId}` so an add-on module can join the set
 * without this file having to know about it.
 *
 * Only Assessment and Plan. Deliberately NOT the objective findings: a
 * hygienist measuring pocket depths and recording what they see is the
 * hygienist doing their job, and blocking that would make the tool unusable
 * for the people who use it most.
 */
export const DENTIST_OWNED_SECTIONS: ReadonlySet<string> = new Set([
  "universal-core.assessment",
  "universal-core.plan"
]);

export function isDentistOwnedSection(moduleId: string, sectionId: string): boolean {
  return DENTIST_OWNED_SECTIONS.has(`${moduleId}.${sectionId}`);
}

/**
 * May this person write a diagnosis or a treatment plan?
 *
 * `unset` returns TRUE, and that default is load-bearing. Every existing
 * account starts there, so turning this on restricts nobody until the practice
 * records who is who. A tool that locked half a dental office out of their own
 * notes the morning it shipped would be turned off by lunchtime — and the
 * accurate statement about an unset account is "we have not been told", which
 * is not grounds to refuse someone their work.
 */
export function canRecordClinicalJudgement(role: ClinicalRole): boolean {
  return role === "unset" || role === "dentist" || role === "smilenotes";
}

/**
 * The explanation shown when a section is locked. Written to name the rule
 * rather than scold the person — they are not doing anything wrong, they are
 * being asked to hand a decision to the clinician who owns it.
 */
export function scopeExplanation(role: ClinicalRole): string {
  const who = role === "assistant" ? "A dental assistant" : "A dental hygienist";
  return `${who} records findings; the dentist records the diagnosis and the plan. Ask the dentist to complete this section, or record what you observed in Objective.`;
}
