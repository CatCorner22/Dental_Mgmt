// THE CHART MODEL — extracted facts arranged for drawing.
//
// ===========================================================================
// WHAT THE ODONTOGRAM IS FOR, and it is not what it looks like it is for.
//
// It is not a charting widget. Nobody fills it in. It is a READBACK: the note,
// rendered in a second modality, so that the writer can check what they said
// against what they meant.
//
// The reason that matters is a class of error text cannot show you. "#14" and
// "#41" are one keystroke apart and both look entirely reasonable in prose —
// but 14 is an upper left first molar and 41 is not a tooth in this notation at
// all, and "#3" versus "#30" is an upper right molar versus a lower right one.
// On a chart, a transposed tooth number is not a subtle difference in a string;
// it is a mark in the wrong quadrant, in the wrong arch, on the wrong side of
// the mouth. The eye catches it instantly and without being told to look.
//
// This is the readback pattern from aviation and emergency dispatch: the way
// you find out that what was heard differs from what was said is to say it back
// in a different form. A chart is a note said back in pictures.
// ===========================================================================
//
// SO THE RULES FOR WHAT GETS PAINTED ARE STRICT:
//
//   - Only what the note AFFIRMS is filled in. A negated finding is drawn as an
//     outline, because "I checked 14 and it was clean" is information a reader
//     wants and is exactly what a blank tooth fails to distinguish from "I never
//     looked at 14".
//   - Anything the note only HINTED at — historical, hypothetical — is drawn
//     faintly and marked. A crown someone else placed in 2019 and a crown
//     planned for next month must not look like a crown placed today.
//   - Nothing is inferred. A tooth the note did not mention is blank, forever.
//     The chart is not a record of the mouth; it is a record of this note.

import type { Surface, ToothId } from "@/lib/schema/types";
import { getTooth } from "@/lib/vocab/teeth";
import { affirmedSites, sitesOfFact } from "./facts";
import type { ExtractionResult, ProcedureCategory, Quadrant, Span } from "./facts";

export interface ChartMark {
  toothId: ToothId;
  /** Surfaces the note named. Empty means whole-tooth. */
  surfaces: Surface[];
  /** Undefined when the note named a tooth without naming a procedure. */
  category?: ProcedureCategory;
  /** Canonical procedure name, for the tooltip and the list. */
  procedure?: string;
  status: "affirmed" | "negated" | "hinted";
  hint?: "historical" | "hypothetical";
  /** Surfaces the note named that cannot exist on this tooth. */
  impossibleSurfaces: string[];
  /** Where in the note this came from, so clicking a tooth can jump there. */
  spans: Span[];
}

/**
 * Which category wins when one tooth carries several.
 *
 * Ordered by how much of the tooth the procedure changes: an extraction beats
 * everything, because a tooth that came out today is the most consequential
 * thing that can be true of it — and a tooth showing both "extracted" and
 * "restored" is precisely the contradiction we want visible rather than
 * averaged away.
 */
const CATEGORY_RANK: Record<ProcedureCategory, number> = {
  surgical: 6,
  endodontic: 5,
  prosthodontic: 4,
  restorative: 3,
  periodontal: 2,
  preventive: 1,
  diagnostic: 0
};

/**
 * Quadrants the note treated as REGIONS, with no tooth named inside them.
 *
 * Reported separately from marks and drawn separately on the chart, because
 * they are a weaker claim. "SRP upper right" says work happened in a quadrant;
 * it does not say which teeth, and a chart that filled in eight teeth would be
 * asserting something the note did not.
 *
 * A quadrant that ALSO has named teeth in the note is dropped here: the teeth
 * are the more specific statement and drawing both would double-count one
 * finding as two.
 */
export function chartRegions(result: ExtractionResult): Quadrant[] {
  const named = new Set<Quadrant>();
  for (const site of affirmedSites(result)) {
    const tooth = getTooth(site.toothId);
    if (tooth) named.add(tooth.quadrant);
  }
  const regions: Quadrant[] = [];
  for (const fact of result.facts) {
    if (fact.assertion.polarity !== "affirmed") continue;
    if (fact.assertion.experiencer !== "patient") continue;
    if (fact.assertion.temporalityHint) continue;
    for (const q of fact.regions ?? []) {
      if (named.has(q) || regions.includes(q)) continue;
      regions.push(q);
    }
  }
  return regions;
}

export function chartMarks(result: ExtractionResult): ChartMark[] {
  const byTooth = new Map<ToothId, ChartMark>();

  // Shared with affirmedSites rather than reimplemented here. The local copy
  // this replaces knew only about tooth-site and procedure facts, so the day
  // findings and materials started carrying sites, "no caries #14" silently
  // stopped reaching the chart at all.
  const sitesOf = sitesOfFact;

  for (const fact of result.facts) {
    // A finding about the patient's father is not a finding about this mouth.
    if (fact.assertion.experiencer !== "patient") continue;

    const status: ChartMark["status"] =
      fact.assertion.polarity === "negated"
        ? "negated"
        : fact.assertion.temporalityHint
          ? "hinted"
          : "affirmed";

    const category = fact.kind === "procedure" ? fact.category : undefined;
    const procedure = fact.kind === "procedure" ? fact.procedure : undefined;

    for (const site of sitesOf(fact)) {
      const existing = byTooth.get(site.toothId);
      if (!existing) {
        byTooth.set(site.toothId, {
          toothId: site.toothId,
          surfaces: [...site.surfaces],
          category,
          procedure,
          status,
          hint: fact.assertion.temporalityHint,
          impossibleSurfaces: [...site.impossibleSurfaces],
          spans: [site.span]
        });
        continue;
      }

      existing.spans.push(site.span);
      for (const s of site.surfaces) if (!existing.surfaces.includes(s)) existing.surfaces.push(s);
      for (const s of site.impossibleSurfaces) {
        if (!existing.impossibleSurfaces.includes(s)) existing.impossibleSurfaces.push(s);
      }
      // An affirmed fact upgrades a negated or hinted one: if the note both
      // cleared a tooth and treated it, the treatment is what happened.
      if (status === "affirmed" && existing.status !== "affirmed") {
        existing.status = "affirmed";
        existing.hint = undefined;
      }
      if (category && (!existing.category || CATEGORY_RANK[category] > CATEGORY_RANK[existing.category])) {
        existing.category = category;
        existing.procedure = procedure;
      }
    }
  }

  return [...byTooth.values()];
}

/**
 * Procedure categories that cannot both be true of one tooth in one visit.
 *
 * DELIBERATELY SHORT, and it stays short. The published base rate for the
 * crispest contradiction type in clinical documentation (radiology laterality)
 * is 0.048% of studies, and a shipped commercial NLP checker for exactly that
 * ran at 36% precision — 64% of what it flagged was its own noise. Meanwhile
 * drug-allergy alerts are overridden 87.6% of the time, and repeated alerts are
 * overridden 12 points harder than first-time ones.
 *
 * The arithmetic is unforgiving: every rule added here dilutes the ones that
 * matter, and a checker that cries wolf costs more safety than it buys. So this
 * list contains only pairs where a false positive is close to impossible, and a
 * fourth entry does not get added until the first two have a measured precision
 * on real notes.
 */
export const CONTRADICTORY_PAIRS: Array<{
  id: string;
  a: ProcedureCategory;
  b: ProcedureCategory;
  why: string;
}> = [
  {
    id: "consistency.extracted-and-restored",
    a: "surgical",
    b: "restorative",
    why: "A tooth removed today cannot also have been filled today."
  },
  {
    id: "consistency.extracted-and-endo",
    a: "surgical",
    b: "endodontic",
    why: "A tooth removed today cannot also have had root canal therapy today."
  }
];

export interface Contradiction {
  id: string;
  toothId: ToothId;
  why: string;
  spans: Span[];
}

/**
 * Contradictions within a single note.
 *
 * Scoped to ONE tooth in ONE note on purpose. A disagreement between two
 * statements from different phases of an encounter is usually a legitimate
 * change over time, and flagging it is how a checker earns the override reflex
 * that makes every later flag invisible.
 */
export function contradictions(result: ExtractionResult): Contradiction[] {
  const byTooth = new Map<ToothId, Map<ProcedureCategory, Span[]>>();
  for (const fact of result.facts) {
    if (fact.kind !== "procedure") continue;
    if (fact.assertion.polarity !== "affirmed") continue;
    if (fact.assertion.experiencer !== "patient") continue;
    // A planned or historical procedure is not a claim about today.
    if (fact.assertion.temporalityHint) continue;
    for (const site of fact.sites) {
      const perTooth = byTooth.get(site.toothId) ?? new Map<ProcedureCategory, Span[]>();
      perTooth.set(fact.category, [...(perTooth.get(fact.category) ?? []), fact.span]);
      byTooth.set(site.toothId, perTooth);
    }
  }

  const found: Contradiction[] = [];
  for (const [toothId, categories] of byTooth) {
    for (const pair of CONTRADICTORY_PAIRS) {
      const a = categories.get(pair.a);
      const b = categories.get(pair.b);
      if (a && b) found.push({ id: pair.id, toothId, why: pair.why, spans: [...a, ...b] });
    }
  }
  return found;
}
