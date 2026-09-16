import type { ModuleDef } from "@/lib/schema/types";
import { universalCore } from "./universal-core";
import { examination } from "./examination";
import { emergency } from "./emergency";
import { imaging } from "./imaging";
import { preventive } from "./preventive";
import { directRestorative } from "./direct-restorative";
import { fixedProsthodontic } from "./fixed-prosthodontic";
import { removableProsthodontic } from "./removable-prosthodontic";
import { endodontic } from "./endodontic";
import { periodontal } from "./periodontal";
import { implant } from "./implant";
import { roboticSurgery } from "./robotic-surgery";
import { operative } from "./operative";
import { extraction } from "./extraction";
import { biopsy } from "./biopsy";
import { boneGraftSinus } from "./bone-graft-sinus";
import { trauma } from "./trauma";
import { nitrous } from "./nitrous";
import { sedationAnesthesia } from "./sedation-anesthesia";
import { pediatric } from "./pediatric";
import { orthodontic } from "./orthodontic";
import { oralMedicine } from "./oral-medicine";
import { anxietyComfort } from "./anxiety-comfort";
import { sleepApnea } from "./sleep-apnea";
import { tmjTmd } from "./tmj-tmd";
import { cosmetic } from "./cosmetic";
import { medication } from "./medication";
import { teledentistry } from "./teledentistry";
import { communicationFollowup } from "./communication-followup";
import { pathologyResult } from "./pathology-result";
import { refusalIncomplete } from "./refusal-incomplete";
import { lateEntry } from "./late-entry";
import { universalProcedure } from "./universal-procedure";

export const ALL_MODULES: ModuleDef[] = [
  universalCore,
  examination,
  emergency,
  imaging,
  preventive,
  directRestorative,
  fixedProsthodontic,
  removableProsthodontic,
  endodontic,
  periodontal,
  implant,
  roboticSurgery,
  operative,
  extraction,
  biopsy,
  boneGraftSinus,
  trauma,
  nitrous,
  sedationAnesthesia,
  pediatric,
  orthodontic,
  oralMedicine,
  anxietyComfort,
  sleepApnea,
  tmjTmd,
  cosmetic,
  medication,
  teledentistry,
  communicationFollowup,
  pathologyResult,
  refusalIncomplete,
  lateEntry,
  universalProcedure
].sort((a, b) => a.order - b.order);

export const MODULES_BY_ID: ReadonlyMap<string, ModuleDef> = new Map(
  ALL_MODULES.map((m) => [m.id, m])
);

export function activeModules(selectedIds: string[]): ModuleDef[] {
  return ALL_MODULES.filter((m) => m.alwaysOn || selectedIds.includes(m.id));
}

// The search box is how a module actually gets found: there are thirty of them
// in a scrolling list, and nobody reads to the bottom.
//
// This matched the TITLE alone, which meant someone typing "TMD" — the term the
// profession uses in speech far more often than "temporomandibular" — got an
// empty list while the module sat three rows below the fold. A module nobody can
// find is a module that does not exist, so the id and description are searched
// too, and each description carries the words staff actually type.
export function moduleMatches(m: ModuleDef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    m.title.toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q) ||
    (m.description ?? "").toLowerCase().includes(q)
  );
}
