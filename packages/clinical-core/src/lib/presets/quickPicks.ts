// Quick Picks preselect a bundle of MODULES for a common visit type, so a user
// starts with the right sections instead of hunting the rail. They select
// structure ONLY — never any field value, and never a clinical assertion.
//
// authorRoles formalizes the TN authority map into template logic: hygienist
// notes, assistant chairside entries, and dentist exams each get scope-
// appropriate scaffolds. `unset` / omitted roles see the shared general set.

import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import {
  authorCapabilities,
  canAuthorSelectModule
} from "@/lib/scope/authorCapabilities";

export interface QuickPick {
  id: string;
  label: string;
  description: string;
  moduleIds: string[]; // add-on module ids; universal-core is always present
  /**
   * Clinical roles that may start from this scaffold. Omit = every role
   * (including unset). A pick is still filtered out if any module fails
   * canAuthorSelectModule for the signed-in role.
   */
  authorRoles?: ClinicalRole[];
  featured?: boolean; // legacy marker; featured sets live on authorCapabilities
}

/** Fallback featured ids when role is unset (matches authorCapabilities.unset). */
export const FEATURED_PICK_IDS = [
  "recall-exam",
  "restorative",
  "simple-extraction",
  "emergency"
] as const;

export const QUICK_PICKS: QuickPick[] = [
  // ── Hygienist-scoped ─────────────────────────────────────────────────────
  {
    id: "hygiene-prophy",
    label: "Hygiene prophylaxis",
    description:
      "Preventive cleaning with imaging — findings for the dentist; Assessment/Plan left for them.",
    moduleIds: ["preventive", "imaging"],
    authorRoles: ["hygienist", "unset"]
  },
  {
    id: "hygiene-periodontal",
    label: "Hygiene periodontal visit",
    description:
      "Periodontal charting and therapy documentation with imaging — dentist diagnoses separately.",
    moduleIds: ["periodontal", "preventive", "imaging"],
    authorRoles: ["hygienist", "unset"]
  },
  // ── Assistant-scoped ─────────────────────────────────────────────────────
  {
    id: "assistant-chairside",
    label: "Chairside assistance",
    description:
      "What the assistant performed and observed with imaging — no diagnosis or plan sections to fill.",
    moduleIds: ["direct-restorative", "imaging", "anxiety-comfort"],
    authorRoles: ["assistant", "unset"]
  },
  // ── Dentist-scoped ───────────────────────────────────────────────────────
  {
    id: "dentist-exam",
    label: "Dentist examination",
    description: "Periodic or comprehensive exam with imaging — includes Assessment and Plan.",
    moduleIds: ["examination", "imaging"],
    authorRoles: ["dentist", "unset"]
  },
  // ── Shared general practice ──────────────────────────────────────────────
  {
    id: "recall-exam",
    label: "Recall exam + cleaning",
    description: "Periodic examination with prophylaxis and imaging.",
    moduleIds: ["examination", "preventive", "imaging"]
  },
  {
    id: "restorative",
    label: "Restoration",
    description: "Direct restoration with imaging and local anesthetic.",
    moduleIds: ["direct-restorative", "imaging", "medication"]
  },
  {
    id: "simple-extraction",
    label: "Simple extraction",
    description: "Extraction with imaging and medication.",
    moduleIds: ["extraction", "imaging", "medication"],
    authorRoles: ["dentist", "assistant", "unset"]
  },
  {
    id: "surgical-extraction-iv",
    label: "Surgical extraction + IV sedation",
    description: "Operative extraction under IV moderate sedation, with imaging and medication.",
    moduleIds: ["extraction", "operative", "sedation-anesthesia", "imaging", "medication"],
    authorRoles: ["dentist", "unset"]
  },
  {
    id: "endo",
    label: "Root canal",
    description: "Endodontic treatment with imaging and medication.",
    moduleIds: ["endodontic", "imaging", "medication"],
    authorRoles: ["dentist", "unset"]
  },
  {
    id: "perio-srp",
    label: "Periodontal therapy",
    description: "Periodontal evaluation and scaling with imaging.",
    moduleIds: ["periodontal", "imaging"]
  },
  {
    id: "emergency",
    label: "Emergency / pain visit",
    description: "Limited emergency evaluation with imaging and medication.",
    moduleIds: ["emergency", "imaging", "medication"]
  },
  {
    id: "implant-placement",
    label: "Implant placement",
    description: "Implant surgery with imaging and medication.",
    moduleIds: ["implant", "operative", "imaging", "medication"],
    authorRoles: ["dentist", "unset"]
  }
];

export function pickAvailableToRole(pick: QuickPick, role: ClinicalRole): boolean {
  if (pick.authorRoles && !pick.authorRoles.includes(role)) return false;
  return pick.moduleIds.every((id) => canAuthorSelectModule(role, id));
}

export function quickPicksForRole(role: ClinicalRole): QuickPick[] {
  return QUICK_PICKS.filter((p) => pickAvailableToRole(p, role));
}

export function featuredPicksForRole(role: ClinicalRole): QuickPick[] {
  const ids = authorCapabilities(role).featuredPickIds;
  const available = quickPicksForRole(role);
  const byId = new Map(available.map((p) => [p.id, p]));
  const ordered: QuickPick[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p) ordered.push(p);
  }
  // If a role's featured list is thin (misconfig), fill from available.
  if (ordered.length < 4) {
    for (const p of available) {
      if (ordered.length >= 4) break;
      if (!ordered.some((o) => o.id === p.id)) ordered.push(p);
    }
  }
  return ordered;
}
